import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import {
  calculateUtilization,
  calculateUtilizationSeries,
  type UtilizationFilters,
} from '@/lib/stock/calculate-utilization'
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters'

export async function GET(req: NextRequest) {
  const auth = await requireView('indicadores')
  if (auth instanceof NextResponse) return auth

  // 🔁 parseIndicadoresQuery aceita PT e EN — o frontend manda PT,
  //    chamadas antigas em EN continuam funcionando.
  const q = parseIndicadoresQuery(req)
  const erro = validatePeriodo(q, { required: true })
  if (erro) return NextResponse.json({ error: erro }, { status: 400 })

  const filters: UtilizationFilters = {
    from: q.from!,
    to: q.to!,
    donorIds: q.doadorIds,
    producerIds: q.produtorIds,
    beneficiaryIds: q.beneficiarioIds,
    employeeIds: q.funcionarioIds,
  }

  const wantsSeries =
    new URL(req.url).searchParams.get('serie') === 'true' ||
    new URL(req.url).searchParams.get('series') === 'true'

  try {
    const data = wantsSeries
      ? await calculateUtilizationSeries(filters)
      : await calculateUtilization(filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[indicadores/aproveitamento] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular indicadores de aproveitamento.' },
      { status: 500 },
    )
  }
}
