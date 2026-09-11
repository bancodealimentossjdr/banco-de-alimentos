// src/app/api/paa/cota/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import { getCotaProdutor, getCotasTodos, getPaaConfig } from '@/lib/paa/cota'

/**
 * 💰 GET /api/paa/cota            → todos os produtores PAA + config
 *    GET /api/paa/cota?producerId= → um produtor
 */
export async function GET(req: NextRequest) {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult

  const producerId = req.nextUrl.searchParams.get('producerId')

  try {
    if (producerId) {
      return NextResponse.json(await getCotaProdutor(producerId))
    }
    const [config, cotas] = await Promise.all([getPaaConfig(), getCotasTodos()])
    return NextResponse.json({ config, cotas })
  } catch (error) {
    console.error('[paa/cota] Erro:', error)
    return NextResponse.json({ error: 'Erro ao calcular cotas.' }, { status: 500 })
  }
}
