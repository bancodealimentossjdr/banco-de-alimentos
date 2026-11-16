import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/auth-helpers'
import { serializeTermo } from '@/lib/paa/termo'

export const dynamic = 'force-dynamic'

/**
 * GET /api/paa/termos/elegiveis?producerId=
 * Entregas ASSINADAS e sem Termo do produtor. Termos são exclusivos de admin/dev.
 * Nunca retorna assinaturaData/assinaturaHash.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult

  const producerId = req.nextUrl.searchParams.get('producerId')
  if (!producerId) {
    return NextResponse.json({ error: 'Informe o produtor.' }, { status: 400 })
  }

  try {
    const entregas = await prisma.entregaPaa.findMany({
      where: { producerId, status: 'ASSINADA', termoPaaId: null },
      orderBy: { dataEntrega: 'asc' },
      take: 200,
      select: {
        id: true,
        dataEntrega: true,
        valorTotal: true,
        pesoTotalKg: true,
        assinaturaEm: true,
        itens: {
          select: {
            productId: true,
            tipoCultivo: true,
            quantidade: true,
            precoUnitario: true,
            subtotal: true,
            pesoKg: true,
            product: { select: { name: true, paaUnidade: true } },
          },
        },
      },
    })
    return NextResponse.json(serializeTermo({ entregas }).entregas)
  } catch (error) {
    console.error('[GET /api/paa/termos/elegiveis] erro:', error)
    return NextResponse.json({ error: 'Erro ao listar entregas elegíveis' }, { status: 500 })
  }
}
