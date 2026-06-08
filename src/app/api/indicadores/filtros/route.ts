import { NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import { getFiltroOpcoes } from '@/lib/data/indicadores-data'

/**
 * GET /api/indicadores/filtros
 * Retorna listas de doadores, produtores, beneficiários e funcionários
 * pra popular os multiselects da página de indicadores.
 */
export async function GET() {
  const authResult = await requireView('indicadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const opcoes = await getFiltroOpcoes()
    return NextResponse.json(opcoes)
  } catch (error) {
    console.error('Erro ao buscar opções de filtros:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar opções de filtros' },
      { status: 500 }
    )
  }
}
