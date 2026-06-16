import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { shouldMaskPersonalData, maskContactName } from '@/lib/mask-by-role'
import {
  getParticipacaoFuncionarios,
  type IndicadoresFilters,
} from '@/lib/data/indicadores-data'

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

    const { funcionarioIds, ...eventFilters } = filters

    // Resultado base (tipo original preservado)
    const base = await getParticipacaoFuncionarios(eventFilters)

    // Filtro opcional por funcionários
    const filtrado =
      funcionarioIds && funcionarioIds.length > 0
        ? base.filter((r) => new Set(funcionarioIds).has(r.funcionarioId))
        : base

    // Mascaramento condicional no servidor (defesa em profundidade)
    const session = await auth()
    const resultadoFinal = shouldMaskPersonalData(session?.user?.role)
      ? filtrado.map((r) => ({
          ...r,
          funcionarioNome: maskContactName(r.funcionarioNome ?? ''),
          // funcionarioRole permanece visível
        }))
      : filtrado

    return NextResponse.json(resultadoFinal)
  } catch (error) {
    console.error('Erro ao calcular participação de funcionários:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular participação de funcionários' },
      { status: 500 }
    )
  }
}
