import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCalibrateStock, requireView } from '@/lib/auth-helpers'
import { z } from 'zod'

// "YYYY-MM-DD" → meia-noite UTC (compatível com @db.Date do StockMarker)
function dateOnlyUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
}

const createSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  quantityKg: z
    .number({ invalid_type_error: 'Peso deve ser um número' })
    .min(0, 'O peso não pode ser negativo'),
  note: z.string().trim().max(500).optional().nullable(),
})

// 📥 GET — lista marcos (histórico de calibrações) · só quem vê estoque
export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const markers = await prisma.stockMarker.findMany({
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    return NextResponse.json({ markers })
  } catch (error) {
    console.error('[MARCOS_GET]', error)
    return NextResponse.json(
      { error: 'Erro ao listar marcos de calibração' },
      { status: 500 },
    )
  }
}

// ➕ POST — cria/atualiza o marco (upsert por data) · 🔒 exclusivo dev
export async function POST(req: NextRequest) {
  const authResult = await requireCalibrateStock()
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const markerDate = dateOnlyUTC(data.date)
    const note = data.note?.trim() || null

    // 🔍 date é @unique → upsert seguro
    const existing = await prisma.stockMarker.findUnique({
      where: { date: markerDate },
    })

    const marker = existing
      ? await prisma.stockMarker.update({
          where: { id: existing.id },
          data: {
            type: 'ADJUSTMENT',
            quantityKg: data.quantityKg,
            note,
            createdById: authResult.user.id,
          },
          include: { createdBy: { select: { id: true, name: true } } },
        })
      : await prisma.stockMarker.create({
          data: {
            type: 'ADJUSTMENT',
            date: markerDate,
            quantityKg: data.quantityKg,
            note,
            createdById: authResult.user.id,
          },
          include: { createdBy: { select: { id: true, name: true } } },
        })

    return NextResponse.json(marker, { status: existing ? 200 : 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 },
      )
    }
    console.error('[MARCOS_POST]', error)
    return NextResponse.json(
      { error: 'Erro ao registrar calibração do estoque' },
      { status: 500 },
    )
  }
}
