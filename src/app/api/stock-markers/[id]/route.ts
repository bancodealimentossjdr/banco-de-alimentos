import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// ============================================
// GET /api/stock-markers/[id]
// Detalhe de um marco específico.
//
// ℹ️ Intencional: sem PUT e sem DELETE.
// Edição e exclusão = ação de DEV via SQL direto no Supabase.
// ============================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const marker = await prisma.stockMarker.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!marker) {
      return NextResponse.json(
        { error: 'Marco não encontrado' },
        { status: 404 },
      )
    }

    return NextResponse.json({
      marker: {
        id: marker.id,
        type: marker.type,
        date: marker.date,
        quantityKg: marker.quantityKg,
        note: marker.note,
        createdAt: marker.createdAt,
        createdBy: marker.createdBy,
      },
    })
  } catch (error) {
    console.error('[GET /api/stock-markers/[id]] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar marco' },
      { status: 500 },
    )
  }
}
