import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { shouldMaskPersonalData, maskContactName } from '@/lib/mask-by-role'
import {
  getParticipacaoFuncionarios,
  type IndicadoresFilters,
} from '@/lib/data/indicadores-data'
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters'

export async function GET(request: NextRequest) {
  const authResult = await requireView('indicadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const q = parseIndicadoresQuery(request)
    const erro = validatePeriodo(q)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const eventFilters: IndicadoresFilters = {
      dataInicio: q.from,
      dataFim: q.to,
      doadorIds: q.doadorIds,
      produtorIds: q.produtorIds,
      beneficiarioIds: q.beneficiarioIds,
    }

    const base = await getParticipacaoFuncionarios(eventFilters)

    const filtrado = q.funcionarioIds?.length
      ? base.filter((r) => new Set(q.funcionarioIds).has(r.funcionarioId))
      : base

    // 🛡️ Máscara no servidor (defesa em profundidade).
    const session = await auth()
    const resultadoFinal = shouldMaskPersonalData(session?.user?.role)
      ? filtrado.map((r) => ({
          ...r,
          funcionarioNome: maskContactName(r.funcionarioNome ?? ''),
        }))
      : filtrado

    return NextResponse.json(resultadoFinal)
  } catch (error) {
    console.error('Erro ao calcular participação de funcionários:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular participação de funcionários' },
      { status: 500 },
    )
  }
}
