import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireAdmin } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ============================================
// GET /api/stock-markers
// Lista todos os marcos (qualquer usuário com acesso a 'estoque').
// ============================================
export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const markers = await prisma.stockMarker.findMany({
      orderBy: { date: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      markers: markers.map((m) => ({
        id: m.id,
        type: m.type,
        date: m.date,
        quantityKg: m.quantityKg,
        note: m.note,
        createdAt: m.createdAt,
        createdBy: m.createdBy,
      })),
    })
  } catch (error) {
    console.error('[GET /api/stock-markers] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao listar marcos de estoque' },
      { status: 500 },
    )
  }
}

// ============================================
// POST /api/stock-markers
// Cria novo marco — APENAS ADMIN.
//
// Regras:
//   1. Marco ZERO é único no sistema
//   2. ADJUSTMENT exige ZERO prévio
//   3. Data > último marco existente (retroativo = DEV via SQL)
//   4. Data não pode ser no futuro
// ============================================
const createMarkerSchema = z.object({
  type: z.enum(['ZERO', 'ADJUSTMENT']),
  date: z.string().min(1, 'Data é obrigatória'),
  quantityKg: z
    .number({ invalid_type_error: 'Quantidade deve ser um número' })
    .nonnegative('Quantidade deve ser ≥ 0'),
  note: z.string().max(500).optional().nullable(),
})

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult
  const session = authResult

  try {
    const body = await req.json()
    const parsed = createMarkerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { type, date, quantityKg, note } = parsed.data
    const markerDate = new Date(date)

    if (isNaN(markerDate.getTime())) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 })
    }

    // 🛡️ Regra 1: Marco ZERO é único
    if (type === 'ZERO') {
      const existingZero = await prisma.stockMarker.findFirst({
        where: { type: 'ZERO' },
      })
      if (existingZero) {
        return NextResponse.json(
          {
            error:
              'Já existe um Marco Zero no sistema. Para registrar uma nova contagem física, use o tipo ADJUSTMENT (recalibração).',
          },
          { status: 409 },
        )
      }
    }

    // 🛡️ Regra 2: ADJUSTMENT exige ZERO prévio
    if (type === 'ADJUSTMENT') {
      const zero = await prisma.stockMarker.findFirst({
        where: { type: 'ZERO' },
      })
      if (!zero) {
        return NextResponse.json(
          {
            error:
              'É necessário criar o Marco Zero antes de registrar recalibrações.',
          },
          { status: 409 },
        )
      }
    }

    // 🛡️ Regra 3: não permitir marco retroativo
    const lastMarker = await prisma.stockMarker.findFirst({
      orderBy: { date: 'desc' },
    })
    if (lastMarker && markerDate <= lastMarker.date) {
      const lastDateStr = lastMarker.date.toISOString().split('T')[0]
      return NextResponse.json(
        {
          error: `Data do marco deve ser posterior ao último marco existente (${lastDateStr}). Marcos retroativos só podem ser criados via console (DEV).`,
        },
        { status: 409 },
      )
    }

    // 🛡️ Regra 4: data não pode ser futura
    if (markerDate > new Date()) {
      return NextResponse.json(
        { error: 'Data do marco não pode ser no futuro.' },
        { status: 400 },
      )
    }

    const marker = await prisma.stockMarker.create({
      data: {
        type,
        date: markerDate,
        quantityKg,
        note: note ?? null,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(
      {
        marker: {
          id: marker.id,
          type: marker.type,
          date: marker.date,
          quantityKg: marker.quantityKg,
          note: marker.note,
          createdAt: marker.createdAt,
          createdBy: marker.createdBy,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/stock-markers] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao criar marco de estoque' },
      { status: 500 },
    )
  }
}
