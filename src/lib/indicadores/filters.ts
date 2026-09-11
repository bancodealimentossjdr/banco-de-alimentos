// src/lib/indicadores/filters.ts
import type { NextRequest } from 'next/server'
import {
  parseYMDtoBrasiliaStart,
  parseYMDtoBrasiliaEnd,
} from '@/lib/date/day-boundaries'

/**
 * 🎯 FONTE ÚNICA de parsing de filtros dos Indicadores.
 *
 * Antes da 23.7a cada rota reimplementava parseCsv/parseIds/parseFrom com
 * regras divergentes:
 *   - macro         → setUTCHours (bordas em UTC)
 *   - tendencias    → setHours    (fuso da MÁQUINA → bug latente)
 *   - aproveitamento→ parseYMDtoBrasilia* (correto)
 *   - participacao  → new Date(`${raw}T00:00:00.000Z`)
 * Resultado: o mesmo período retornava números diferentes por rota.
 *
 * Agora todas usam Brasília (UTC-3) via day-boundaries.
 *
 * 🔁 Retrocompat: aceita nomes PT (frontend) e EN (aproveitamento).
 */

export interface IndicadoresQuery {
  from?: Date
  to?: Date
  fromRaw: string | null
  toRaw: string | null
  doadorIds?: string[]
  produtorIds?: string[]
  beneficiarioIds?: string[]
  funcionarioIds?: string[]
  produtoIds?: string[]
}

function parseCsv(
  params: URLSearchParams,
  ...keys: string[]
): string[] | undefined {
  for (const key of keys) {
    const raw = params.get(key)
    if (!raw) continue
    const ids = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length) return ids
  }
  return undefined
}

export function parseIndicadoresQuery(
  input: NextRequest | URLSearchParams | string,
): IndicadoresQuery {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URL(typeof input === 'string' ? input : input.url).searchParams

  const fromRaw = params.get('from')
  const toRaw = params.get('to')

  let from: Date | undefined
  let to: Date | undefined

  try {
    if (fromRaw) from = parseYMDtoBrasiliaStart(fromRaw)
  } catch {
    from = undefined
  }
  try {
    if (toRaw) to = parseYMDtoBrasiliaEnd(toRaw)
  } catch {
    to = undefined
  }

  return {
    from,
    to,
    fromRaw,
    toRaw,
    doadorIds: parseCsv(params, 'doadorIds', 'donorIds'),
    produtorIds: parseCsv(params, 'produtorIds', 'producerIds'),
    beneficiarioIds: parseCsv(params, 'beneficiarioIds', 'beneficiaryIds'),
    funcionarioIds: parseCsv(params, 'funcionarioIds', 'employeeIds'),
    produtoIds: parseCsv(params, 'produtoIds', 'productIds'),
  }
}

/** Valida o par de datas. Retorna string de erro ou null. */
export function validatePeriodo(
  q: IndicadoresQuery,
  opts: { required?: boolean } = {},
): string | null {
  if (opts.required && (!q.fromRaw || !q.toRaw))
    return 'Parâmetros "from" e "to" são obrigatórios.'
  if (q.fromRaw && !q.from)
    return 'Data inicial inválida. Esperado YYYY-MM-DD.'
  if (q.toRaw && !q.to) return 'Data final inválida. Esperado YYYY-MM-DD.'
  if (q.from && q.to && q.from > q.to)
    return 'A data inicial não pode ser maior que a final.'
  return null
}

/* ================================================================== */
/* 🖥️ Lado cliente — contrato de serialização                          */
/* ================================================================== */

export interface FiltrosState {
  from: string
  to: string
  doadorIds: string[]
  produtorIds: string[]
  beneficiarioIds: string[]
  funcionarioIds: string[]
}

export const EMPTY_FILTROS: Omit<FiltrosState, 'from' | 'to'> = {
  doadorIds: [],
  produtorIds: [],
  beneficiarioIds: [],
  funcionarioIds: [],
}

/**
 * 🔗 Serializa o estado COMPLETO para query string.
 *
 * ⚠️ Este é o bug central da 23.7a: page.tsx montava
 *      `from=${f.from}&to=${f.to}`
 *    e os dropdowns NUNCA saíam do navegador.
 */
export function buildIndicadoresQuery(f: FiltrosState): string {
  const p = new URLSearchParams()
  p.set('from', f.from)
  p.set('to', f.to)
  if (f.doadorIds.length) p.set('doadorIds', f.doadorIds.join(','))
  if (f.produtorIds.length) p.set('produtorIds', f.produtorIds.join(','))
  if (f.beneficiarioIds.length)
    p.set('beneficiarioIds', f.beneficiarioIds.join(','))
  if (f.funcionarioIds.length)
    p.set('funcionarioIds', f.funcionarioIds.join(','))
  return p.toString()
}

export function countFiltrosAtivos(f: FiltrosState): number {
  return (
    f.doadorIds.length +
    f.produtorIds.length +
    f.beneficiarioIds.length +
    f.funcionarioIds.length
  )
}
