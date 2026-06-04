import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import {
  calculateUtilization,
  calculateUtilizationSeries,
  type UtilizationFilters,
} from '@/lib/stock/calculate-utilization'

/* ------------------------------------------------------------------ */
/* Helper: CSV da query string -> string[] | undefined                 */
/* "a,b,c" -> ['a','b','c'] | "" / null -> undefined                   */
/* ------------------------------------------------------------------ */
function parseIds(raw: string | null): string[] | undefined {
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

export async function GET(req: NextRequest) {
  // 🔐 Mesmo padrão do /api/indicadores/macro
  const auth = await requireView('estoque')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)

  // ----------------------------------------------------------------
  // Período (mesma lógica do macro: 'to' cobre o dia inteiro)
  // ----------------------------------------------------------------
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  if (!fromRaw || !toRaw) {
    return NextResponse.json(
      { error: 'Parâmetros "from" e "to" são obrigatórios.' },
      { status: 400 },
    )
  }

  const from = new Date(fromRaw)
  const to = new Date(toRaw)

  // Validação de datas
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json(
      { error: 'Datas inválidas em "from" ou "to".' },
      { status: 400 },
    )
  }

  // Normaliza o range: from 00:00:00.000 .. to 23:59:59.999
  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)

  if (from > to) {
    return NextResponse.json(
      { error: 'A data inicial não pode ser maior que a final.' },
      { status: 400 },
    )
  }

  // ----------------------------------------------------------------
  // 4 filtros multi-select (CSV na query string)
  // ----------------------------------------------------------------
  const filters: UtilizationFilters = {
    from,
    to,
    donorIds: parseIds(searchParams.get('donorIds')),
    producerIds: parseIds(searchParams.get('producerIds')),
    beneficiaryIds: parseIds(searchParams.get('beneficiaryIds')),
    employeeIds: parseIds(searchParams.get('employeeIds')),
  }

  // ----------------------------------------------------------------
  // 🆕 Modo SÉRIE temporal: ?serie=true
  //    Retorna a evolução por dia/semana/mês (granularidade auto).
  //    Aceita os MESMOS filtros (mas a série só existe na visão geral).
  // ----------------------------------------------------------------
  const wantsSeries =
    searchParams.get('serie') === 'true' ||
    searchParams.get('series') === 'true'

  // ----------------------------------------------------------------
  // Delegação à lib oficial (fonte única de cálculo)
  // ----------------------------------------------------------------
  try {
    if (wantsSeries) {
      const series = await calculateUtilizationSeries(filters)
      return NextResponse.json(series)
    }

    const snapshot = await calculateUtilization(filters)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('[GET /api/indicadores/aproveitamento] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular indicadores de aproveitamento.' },
      { status: 500 },
    )
  }
}
