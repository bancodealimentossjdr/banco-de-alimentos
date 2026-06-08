import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import {
  getParticipacaoFuncionarios,
  type IndicadoresFilters,
} from '@/lib/data/indicadores-data'

/**
 * GET /api/indicadores/participacao-funcionarios
 *
 * Query params (todos opcionais):
 *   - from: YYYY-MM-DD (data início)
 *   - to: YYYY-MM-DD (data fim)
 *   - doadorIds: csv
 *   - produtorIds: csv
 *   - beneficiarioIds: csv
 *   - funcionarioIds: csv (filtra pra listar SÓ esses na resposta)
 */
export async function GET(request: NextRequest) {
  const authResult = await requireView('indicadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(request.url)

    const parseCsv = (key: string): string[] | undefined => {
      const raw = searchParams.get(key)
      if (!raw) return undefined
      const arr = raw.split(',').map((s) => s.trim()).filter(Boolean)
      return arr.length ? arr : undefined
    }

    // from = início do dia; to = fim do dia (inclusivo)
    const parseFrom = (): Date | undefined => {
      const raw = searchParams.get('from')
      if (!raw) return undefined
      const d = new Date(`${raw}T00:00:00.000Z`)
      return isNaN(d.getTime()) ? undefined : d
    }
    const parseTo = (): Date | undefined => {
      const raw = searchParams.get('to')
      if (!raw) return undefined
      const d = new Date(`${raw}T23:59:59.999Z`)
      return isNaN(d.getTime()) ? undefined : d
    }

    const filters: IndicadoresFilters = {
      dataInicio: parseFrom(),
      dataFim: parseTo(),
      doadorIds: parseCsv('doadorIds'),
      produtorIds: parseCsv('produtorIds'),
      beneficiarioIds: parseCsv('beneficiarioIds'),
      funcionarioIds: parseCsv('funcionarioIds'),
    }

    // Calcula participação de TODOS os funcionários
    const { funcionarioIds, ...eventFilters } = filters
    let resultado = await getParticipacaoFuncionarios(eventFilters)

    // Filtra a lista de resposta se o usuário escolheu funcionários específicos
    if (funcionarioIds && funcionarioIds.length > 0) {
      const set = new Set(funcionarioIds)
      resultado = resultado.filter((r) => set.has(r.funcionarioId))
    }

    return NextResponse.json(resultado)
  } catch (error) {
    console.error('Erro ao calcular participação de funcionários:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular participação de funcionários' },
      { status: 500 }
    )
  }
}
