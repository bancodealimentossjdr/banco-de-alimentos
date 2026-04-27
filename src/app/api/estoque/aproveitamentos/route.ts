import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { z } from 'zod'

// ✅ Helper: converte "YYYY-MM-DD" em intervalo UTC do dia
function getDayRangeUTC(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
  const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
  return { dayStart, dayEnd }
}

// ✅ Aceita tanto "approvedQuantity" quanto "approvedQty" (compatibilidade)
const createSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  approvedQuantity: z.number().min(0).optional(),
  approvedQty: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => data.approvedQuantity !== undefined || data.approvedQty !== undefined,
  { message: 'approvedQuantity é obrigatório' }
)

// 📥 GET — listar aproveitamentos
export async function GET(req: NextRequest) {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = getDayRangeUTC(from).dayStart
      if (to) dateFilter.lte = getDayRangeUTC(to).dayEnd
      where.date = dateFilter
    }

    const [items, total] = await Promise.all([
      prisma.dailyApproval.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailyApproval.count({ where }),
    ])

    // Enriquece com totalReceived calculado
    const enriched = await Promise.all(
      items.map(async (item) => {
        const itemDate = item.date.toISOString().split('T')[0]
        const { dayStart, dayEnd } = getDayRangeUTC(itemDate)

        const donationItems = await prisma.donationItem.findMany({
          where: {
            donation: { date: { gte: dayStart, lte: dayEnd } },
          },
          select: { quantity: true },
        })

        const totalReceived = donationItems.reduce((s, i) => s + i.quantity, 0)
        const loss = Math.max(0, totalReceived - item.approvedQty)
        const approvalRate =
          totalReceived > 0 ? (item.approvedQty / totalReceived) * 100 : 0

        return {
          ...item,
          totalReceived,
          loss,
          approvalRate: Number(approvalRate.toFixed(2)),
        }
      }),
    )

    return NextResponse.json({
      items: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[APROVEITAMENTOS_GET]', error)
    return NextResponse.json(
      { error: 'Erro ao listar aproveitamentos' },
      { status: 500 },
    )
  }
}

// ➕ POST — criar OU atualizar aproveitamento (upsert)
export async function POST(req: NextRequest) {
  // ✅ FIX: usa permissão de "doacoes" (mesma do operador que registra dados)
  const authResult = await requireEdit('doacoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    // ✅ Aceita ambos os nomes de campo
    const approvedQty = data.approvedQuantity ?? data.approvedQty ?? 0

    const { dayStart, dayEnd } = getDayRangeUTC(data.date)

    // 🌾 Buscar doações e colheita do dia (mesmo padrão do preview)
const [donationItems, harvests] = await Promise.all([
  prisma.donationItem.findMany({
    where: {
      donation: { date: { gte: dayStart, lte: dayEnd } },
    },
    select: { quantity: true },
  }),
  prisma.solidarityHarvest.findMany({
    where: { date: { gte: dayStart, lte: dayEnd } },
    include: {
      items: { select: { quantity: true } },
    },
  }),
])

const donationsTotal = donationItems.reduce(
  (s: number, i: { quantity: number }) => s + i.quantity,
  0,
)
const harvestTotal = harvests.reduce(
  (sum: number, h: { items: { quantity: number }[] }) =>
    sum + h.items.reduce((s, i) => s + i.quantity, 0),
  0,
)
const totalReceived = donationsTotal + harvestTotal

    if (approvedQty > totalReceived) {
      return NextResponse.json(
        {
          error: `Aproveitado (${approvedQty} kg) não pode ser maior que o recebido (${totalReceived} kg)`,
        },
        { status: 400 },
      )
    }

    // 🔍 Verifica se já existe (busca por intervalo, mais robusto)
    const existing = await prisma.dailyApproval.findFirst({
      where: { date: { gte: dayStart, lte: dayEnd } },
    })

    let approval
    if (existing) {
      // ✅ ATUALIZA existente
      approval = await prisma.dailyApproval.update({
        where: { id: existing.id },
        data: {
          approvedQty,
          notes: data.notes,
          updatedById: authResult.user.id,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
        },
      })
      return NextResponse.json(approval, { status: 200 })
    } else {
      // ➕ CRIA novo
      approval = await prisma.dailyApproval.create({
        data: {
          date: dayStart,
          approvedQty,
          notes: data.notes,
          createdById: authResult.user.id,
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      })
      return NextResponse.json(approval, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 },
      )
    }
    console.error('[APROVEITAMENTOS_POST]', error)
    return NextResponse.json(
      { error: 'Erro ao registrar aproveitamento' },
      { status: 500 },
    )
  }
}
