import { NextRequest, NextResponse } from 'next/server'
import { requireView } from '@/lib/auth-helpers'
import {
  calculateUtilization,
  calculateUtilizationSeries,
  type UtilizationFilters,
} from '@/lib/stock/calculate-utilization'
import {
  parseYMDtoBrasiliaStart,
  parseYMDtoBrasiliaEnd,
} from '@/lib/date/day-boundaries'

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
  // Período em horário de BRASÍLIA (UTC−3)
  // - 'from' vira 00:00:00.000 BSB (= 03:00 UTC)
  // - 'to'   vira 23:59:59.999 BSB (= 02:59:59 UTC do dia seguinte)
  //
  // Antes (bug): from.setHours(0,0,0,0) usava fuso do servidor (UTC na
  // Vercel) → range deslocado em 3h. Cadastros entre 21h-23h59 BSB
  // ficavam de fora.
  // ----------------------------------------------------------------
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  if (!fromRaw || !toRaw) {
    return NextResponse.json(
      { error: 'Parâmetros "from" e "to" são obrigatórios.' },
      { status: 400 },
    )
  }

  let from: Date
  let to: Date
  try {
    from = parseYMDtoBrasiliaStart(fromRaw)
    to = parseYMDtoBrasiliaEnd(toRaw)
  } catch (e) {
    return NextResponse.json(
      { error: 'Datas inválidas em "from" ou "to". Esperado YYYY-MM-DD.' },
      { status: 400 },
    )
  }

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
