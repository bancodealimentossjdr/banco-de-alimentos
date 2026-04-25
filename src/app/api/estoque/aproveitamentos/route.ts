import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { z } from 'zod'
import { startOfDay, endOfDay, parseISO } from 'date-fns'

const createSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  approvedQty: z.number().min(0, 'Quantidade deve ser >= 0'),
  notes: z.string().optional().nullable(),
})

// 📥 GET — listar aproveitamentos com paginação e filtro de período
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
      if (from) dateFilter.gte = startOfDay(parseISO(from))
      if (to) dateFilter.lte = endOfDay(parseISO(to))
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

    // 🔍 Para cada aproveitamento, calcular o total recebido daquele dia
    const enriched = await Promise.all(
      items.map(async (item) => {
        const dayStart = startOfDay(item.date)
        const dayEnd = endOfDay(item.date)

        // Soma dos itens das doações do dia
        const donationItems = await prisma.donationItem.findMany({
          where: {
            donation: {
              date: { gte: dayStart, lte: dayEnd },
            },
          },
          select: { quantity: true },
        })

        const totalReceived = donationItems.reduce(
          (s, i) => s + i.quantity,
          0,
        )
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

// ➕ POST — criar aproveitamento
export async function POST(req: NextRequest) {
  const authResult = await requireEdit('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const date = parseISO(data.date)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // 🛡️ Verificar se já existe registro pra esse dia
    const existing = await prisma.dailyApproval.findUnique({
      where: { date: dayStart },
    })

    if (existing) {
      return NextResponse.json(
        {
          error:
            'Já existe um aproveitamento registrado para esta data. Edite o existente.',
        },
        { status: 409 },
      )
    }

    // 🧮 Validar: aproveitado não pode ser maior que recebido
    const donationItems = await prisma.donationItem.findMany({
      where: {
        donation: {
          date: { gte: dayStart, lte: dayEnd },
        },
      },
      select: { quantity: true },
    })

    const totalReceived = donationItems.reduce((s, i) => s + i.quantity, 0)

    if (data.approvedQty > totalReceived) {
      return NextResponse.json(
        {
          error: `Aproveitado (${data.approvedQty} kg) não pode ser maior que o recebido (${totalReceived} kg)`,
        },
        { status: 400 },
      )
    }

    const approval = await prisma.dailyApproval.create({
      data: {
        date: dayStart,
        approvedQty: data.approvedQty,
        notes: data.notes,
        createdById: authResult.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(approval, { status: 201 })
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
