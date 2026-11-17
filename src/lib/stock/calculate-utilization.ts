import { prisma } from '@/lib/prisma'
import { calculateStock } from '@/lib/stock/calculate-stock'
import { startOfDayBrasilia } from '@/lib/date/day-boundaries'
import {
  mesesTocados,
  buscarLegadoPorMes,
  escolher,
  mesTemPlanilha,
  mesSemTaxa,
  chaveMesDateTime,
  chaveMesDateOnly,
} from '@/lib/serie-mensal'

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type UtilizationFilters = {
  from: Date // já normalizado para início do dia em Brasília (UTC−3)
  to: Date // já normalizado para fim do dia em Brasília (UTC−3)
  donorIds?: string[]
  producerIds?: string[]
  beneficiaryIds?: string[]
  employeeIds?: string[] // 👷 multi-select; checa os 3 slots via OR
}

export type UtilizationSnapshot = {
  period: { from: Date; to: Date }
  hasEntityFilter: boolean
  volumes: {
    donationsKg: number
    harvestKg: number
    distributedKg: number
  }
  utilization: {
    approvedKg: number | null
    utilizationPct: number | null
    destinationPct: number | null
    lossKg: number | null
    currentStockKg: number | null
  }
  // 📜 meses "YYYY-MM" em que a planilha entrou (inteiros — opção b)
  mesesPlanilha: string[]
  calculatedAt: Date
}

export type SeriesGranularity = 'day' | 'week' | 'month'

export type UtilizationSeriesPoint = {
  bucket: string
  label: string
  donationsKg: number
  harvestKg: number
  approvedKg: number
  approvedTotalKg: number
  distributedKg: number
  lossKg: number
  paaKg: number
  // 📜 true = algum volume deste mês veio da planilha
  planilha: boolean
}

export type UtilizationSeries = {
  period: { from: Date; to: Date }
  granularity: SeriesGranularity
  hasEntityFilter: boolean
  points: UtilizationSeriesPoint[]
  mesesPlanilha: string[]
  calculatedAt: Date
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const EMPTY_SNAPSHOT = (
  from: Date,
  to: Date,
  hasEntityFilter: boolean,
): UtilizationSnapshot => ({
  period: { from, to },
  hasEntityFilter,
  volumes: { donationsKg: 0, harvestKg: 0, distributedKg: 0 },
  utilization: {
    approvedKg: hasEntityFilter ? null : 0,
    utilizationPct: hasEntityFilter ? null : 0,
    destinationPct: hasEntityFilter ? null : 0,
    lossKg: hasEntityFilter ? null : 0,
    currentStockKg: hasEntityFilter ? null : 0,
  },
  mesesPlanilha: [],
  calculatedAt: new Date(),
})

const EMPTY_SERIES = (
  from: Date,
  to: Date,
  granularity: SeriesGranularity,
  hasEntityFilter: boolean,
): UtilizationSeries => ({
  period: { from, to },
  granularity,
  hasEntityFilter,
  points: [],
  mesesPlanilha: [],
  calculatedAt: new Date(),
})

/* ------------------------------------------------------------------ */
/* SNAPSHOT                                                            */
/* ------------------------------------------------------------------ */

export async function calculateUtilization(
  filters: UtilizationFilters,
): Promise<UtilizationSnapshot> {
  const { from, to } = filters

  const donorIds = nonEmpty(filters.donorIds)
  const producerIds = nonEmpty(filters.producerIds)
  const beneficiaryIds = nonEmpty(filters.beneficiaryIds)
  const employeeIds = nonEmpty(filters.employeeIds)

  const hasEntityFilter = Boolean(
    donorIds || producerIds || beneficiaryIds || employeeIds,
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).donationItem || !(prisma as any).dailyApproval) {
    console.warn(
      '[calculateUtilization] prisma indisponível. ' +
        'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SNAPSHOT(from, to, hasEntityFilter)
  }

  try {
    const employeeOR = employeeIds
      ? {
          OR: [
            { employeeId: { in: employeeIds } },
            { employee2Id: { in: employeeIds } },
            { employee3Id: { in: employeeIds } },
          ],
        }
      : {}

    const donationWhere = {
      date: { gte: from, lte: to },
      ...(donorIds ? { donorId: { in: donorIds } } : {}),
      ...employeeOR,
    }

    const harvestWhere = {
      date: { gte: from, lte: to },
      status: 'realizada',
      ...(producerIds ? { producerId: { in: producerIds } } : {}),
      ...employeeOR,
    }

    const distributionWhere = {
      date: { gte: from, lte: to },
      ...(beneficiaryIds ? { beneficiaryId: { in: beneficiaryIds } } : {}),
      ...employeeOR,
    }

    const [donationItems, harvestItems, distributionItems] = await Promise.all([
      prisma.donationItem.findMany({
        where: { donation: donationWhere },
        select: { quantity: true, donation: { select: { date: true } } },
      }),
      prisma.harvestItem.findMany({
        where: { harvest: harvestWhere },
        select: { quantity: true, harvest: { select: { date: true } } },
      }),
      prisma.distributionItem.findMany({
        where: { distribution: distributionWhere },
        select: { quantity: true, distribution: { select: { date: true } } },
      }),
    ])

    // ----------------------------------------------------------------
    // 🔍 Filtro por entidade: planilha NÃO entra (não tem doador etc.)
    // ----------------------------------------------------------------
    if (hasEntityFilter) {
      return {
        period: { from, to },
        hasEntityFilter: true,
        volumes: {
          donationsKg: round3(sumQty(donationItems)),
          harvestKg: round3(sumQty(harvestItems)),
          distributedKg: round3(sumQty(distributionItems)),
        },
        utilization: {
          approvedKg: null,
          utilizationPct: null,
          destinationPct: null,
          lossKg: null,
          currentStockKg: null,
        },
        mesesPlanilha: [],
        calculatedAt: new Date(),
      }
    }

    // ---- Visão geral ----
    const [approvalRows, legado] = await Promise.all([
      prisma.dailyApproval.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, approvedQty: true },
      }),
      buscarLegadoPorMes(mesesTocados(from, to)),
    ])

    const appDoa = agruparMes(donationItems, (i) => chaveMesDateTime(i.donation.date))
    const appHar = agruparMes(harvestItems, (i) => chaveMesDateTime(i.harvest.date))
    const appDis = agruparMes(distributionItems, (i) => chaveMesDateTime(i.distribution.date))
    const appApr = new Map<string, number>()
    for (const a of approvalRows) {
      const k = chaveMesDateOnly(a.date)
      appApr.set(k, (appApr.get(k) ?? 0) + a.approvedQty)
    }

    const meses = mesesTocados(from, to)
    const mesesPlanilha = meses.filter((k) => mesTemPlanilha(legado.get(k)))

    // 📊 Volumes (Regra B por mês) + bases "limpas" para as taxas
    let donationsKg = 0, harvestKg = 0, distributedKg = 0
    let tDoa = 0, tHar = 0, tDis = 0, tApr = 0

    for (const k of meses) {
      const l = legado.get(k)
      const d = escolher(l?.DOACAO ?? 0, appDoa.get(k) ?? 0)
      const c = escolher(l?.COLHEITA ?? 0, appHar.get(k) ?? 0)
      const x = escolher(l?.DISTRIBUICAO ?? 0, appDis.get(k) ?? 0)
      donationsKg += d
      harvestKg += c
      distributedKg += x
      if (!mesSemTaxa(l)) {
        tDoa += d
        tHar += c
        tDis += x
        tApr += appApr.get(k) ?? 0
      }
    }

    donationsKg = round3(donationsKg)
    harvestKg = round3(harvestKg)
    distributedKg = round3(distributedKg)

    // 🧮 FÓRMULAS OFICIAIS (Onda 16.5) — só sobre meses sem planilha
    const approvedKg = round3(tApr)
    const entradasKg = round3(tDoa + tHar)
    const aproveitadoTotalKg = round3(approvedKg + tHar)

    const utilizationPct =
      entradasKg > 0 ? round1((aproveitadoTotalKg / entradasKg) * 100) : 0
    const destinationPct =
      aproveitadoTotalKg > 0 ? round1((tDis / aproveitadoTotalKg) * 100) : 0
    const lossKg = round3(Math.max(0, tDoa - approvedKg))

    const stock = await calculateStock(to)
    const currentStockKg = stock.hasMarker ? stock.currentStockKg : null

    return {
      period: { from, to },
      hasEntityFilter: false,
      volumes: { donationsKg, harvestKg, distributedKg },
      utilization: {
        approvedKg,
        utilizationPct,
        destinationPct,
        lossKg,
        currentStockKg,
      },
      mesesPlanilha,
      calculatedAt: new Date(),
    }
  } catch (error) {
    console.error('[calculateUtilization] Erro inesperado:', error)
    return EMPTY_SNAPSHOT(from, to, hasEntityFilter)
  }
}

/* ------------------------------------------------------------------ */
/* SÉRIE TEMPORAL                                                      */
/* Granularidade: ≤31d day | ≤92d week | >92 month                      */
/* 📜 Se o período toca mês da planilha → força 'month'.               */
/* ------------------------------------------------------------------ */

export async function calculateUtilizationSeries(
  filters: UtilizationFilters,
): Promise<UtilizationSeries> {
  const { from, to } = filters

  const donorIds = nonEmpty(filters.donorIds)
  const producerIds = nonEmpty(filters.producerIds)
  const beneficiaryIds = nonEmpty(filters.beneficiaryIds)
  const employeeIds = nonEmpty(filters.employeeIds)

  const hasEntityFilter = Boolean(
    donorIds || producerIds || beneficiaryIds || employeeIds,
  )

  let granularity = pickGranularity(from, to)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).donationItem || !(prisma as any).dailyApproval) {
    console.warn(
      '[calculateUtilizationSeries] prisma indisponível. ' +
        'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SERIES(from, to, granularity, hasEntityFilter)
  }

  if (hasEntityFilter) {
    return EMPTY_SERIES(from, to, granularity, true)
  }

  try {
    const legado = await buscarLegadoPorMes(mesesTocados(from, to))
    const mesesPlanilha = mesesTocados(from, to).filter((k) =>
      mesTemPlanilha(legado.get(k)),
    )
    if (mesesPlanilha.length > 0) granularity = 'month'

    const paaRange = dateOnlyRange(from, to)

    const [
      donationItems,
      harvestItems,
      distributionItems,
      approvalRows,
      paaItems,
    ] = await Promise.all([
      prisma.donationItem.findMany({
        where: { donation: { date: { gte: from, lte: to } } },
        select: { quantity: true, donation: { select: { date: true } } },
      }),
      prisma.harvestItem.findMany({
        where: {
          harvest: { date: { gte: from, lte: to }, status: 'realizada' },
        },
        select: { quantity: true, harvest: { select: { date: true } } },
      }),
      prisma.distributionItem.findMany({
        where: { distribution: { date: { gte: from, lte: to } } },
        select: {
          quantity: true,
          distribution: { select: { date: true } },
        },
      }),
      prisma.dailyApproval.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, approvedQty: true },
      }),
      prisma.entregaPaaItem.findMany({
        where: { entregaPaa: { dataEntrega: paaRange } },
        select: {
          pesoKg: true,
          entregaPaa: { select: { dataEntrega: true } },
        },
      }),
    ])

    const buckets = buildBuckets(from, to, granularity)

    const addLocal = (
      date: Date,
      field: 'donationsKg' | 'harvestKg' | 'distributedKg',
      qty: number,
    ) => {
      const key = bucketKey(date, granularity)
      const point = buckets.get(key)
      if (point) point[field] = round3(point[field] + qty)
    }

    const addDateOnly = (
      date: Date,
      field: 'approvedKg' | 'paaKg',
      qty: number,
    ) => {
      const key = bucketKeyDateOnly(date, granularity)
      const point = buckets.get(key)
      if (point) point[field] = round3(point[field] + qty)
    }

    for (const it of donationItems) addLocal(it.donation.date, 'donationsKg', it.quantity)
    for (const it of harvestItems) addLocal(it.harvest.date, 'harvestKg', it.quantity)
    for (const it of distributionItems) addLocal(it.distribution.date, 'distributedKg', it.quantity)
    for (const ap of approvalRows) addDateOnly(ap.date, 'approvedKg', ap.approvedQty)
    for (const it of paaItems) {
      const kg = Number(it.pesoKg ?? 0)
      if (!Number.isFinite(kg)) continue
      addDateOnly(it.entregaPaa.dataEntrega, 'paaKg', kg)
    }

    const points: UtilizationSeriesPoint[] = Array.from(buckets.values()).map((p) => {
      // 📜 só em granularidade mensal o bucket = mês civil
      const l = granularity === 'month' ? legado.get(p.bucket.slice(0, 7)) : undefined
      const donationsKg = round3(escolher(l?.DOACAO ?? 0, p.donationsKg))
      const harvestKg = round3(escolher(l?.COLHEITA ?? 0, p.harvestKg))
      const distributedKg = round3(escolher(l?.DISTRIBUICAO ?? 0, p.distributedKg))
      const semTaxa = mesSemTaxa(l)
      return {
        bucket: p.bucket,
        label: p.label,
        donationsKg,
        harvestKg,
        approvedKg: p.approvedKg,
        distributedKg,
        // 🌾 colheita 100% aproveitada; 📜 mês de planilha não tem taxa
        approvedTotalKg: semTaxa ? 0 : round3(p.approvedKg + harvestKg),
        lossKg: semTaxa ? 0 : round3(Math.max(0, donationsKg - p.approvedKg)),
        paaKg: p.paaKg,
        planilha: mesTemPlanilha(l),
      }
    })

    return {
      period: { from, to },
      granularity,
      hasEntityFilter: false,
      points,
      mesesPlanilha,
      calculatedAt: new Date(),
    }
  } catch (error) {
    console.error('[calculateUtilizationSeries] Erro inesperado:', error)
    return EMPTY_SERIES(from, to, granularity, hasEntityFilter)
  }
}

/* ------------------------------------------------------------------ */
/* Helpers gerais                                                      */
/* ------------------------------------------------------------------ */

function sumQty(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}

function agruparMes<T extends { quantity: number }>(
  items: T[],
  key: (i: T) => string,
): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of items) {
    const k = key(i)
    m.set(k, (m.get(k) ?? 0) + i.quantity)
  }
  return m
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function nonEmpty(arr?: string[]): string[] | undefined {
  return arr && arr.length > 0 ? arr : undefined
}

/* ------------------------------------------------------------------ */
/* Helpers da série temporal                                           */
/* ------------------------------------------------------------------ */

function pickGranularity(from: Date, to: Date): SeriesGranularity {
  const days = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1
  if (days <= 31) return 'day'
  if (days <= 92) return 'week'
  return 'month'
}

function brasiliaCivilParts(date: Date): { y: number; m: number; d: number } {
  const start = startOfDayBrasilia(date)
  return {
    y: start.getUTCFullYear(),
    m: start.getUTCMonth(),
    d: start.getUTCDate(),
  }
}

function dayKeyFromParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
}

function dateOnlyRange(from: Date, to: Date): { gte: Date; lte: Date } {
  const f = brasiliaCivilParts(from)
  const t = brasiliaCivilParts(to)
  return {
    gte: dayKeyFromParts(f.y, f.m, f.d),
    lte: dayKeyFromParts(t.y, t.m, t.d),
  }
}

function toMonday(dayStart: Date): Date {
  const s = new Date(dayStart)
  const dow = s.getUTCDay()
  const diff = dow === 0 ? 6 : dow - 1
  s.setUTCDate(s.getUTCDate() - diff)
  return s
}

function bucketStartFromParts(
  y: number,
  m: number,
  d: number,
  g: SeriesGranularity,
): Date {
  if (g === 'day') return dayKeyFromParts(y, m, d)
  if (g === 'week') return toMonday(dayKeyFromParts(y, m, d))
  return dayKeyFromParts(y, m, 1)
}

function bucketKey(date: Date, g: SeriesGranularity): string {
  const { y, m, d } = brasiliaCivilParts(date)
  return bucketStartFromParts(y, m, d, g).toISOString().slice(0, 10)
}

function bucketKeyDateOnly(date: Date, g: SeriesGranularity): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()
  return bucketStartFromParts(y, m, d, g).toISOString().slice(0, 10)
}

function bucketEnd(start: Date, g: SeriesGranularity): Date {
  if (g === 'day') return start
  if (g === 'week') return new Date(start.getTime() + 6 * MS_PER_DAY)
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 0, 0, 0, 0),
  )
}

function bucketLabel(start: Date, g: SeriesGranularity): string {
  const fmtDM = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}/${String(
      d.getUTCMonth() + 1,
    ).padStart(2, '0')}`

  if (g === 'day') return fmtDM(start)
  if (g === 'week') return `${fmtDM(start)} – ${fmtDM(bucketEnd(start, g))}`

  const mm = String(start.getUTCMonth() + 1).padStart(2, '0')
  return `${mm}/${start.getUTCFullYear()}`
}

type BucketAcc = {
  bucket: string
  label: string
  donationsKg: number
  harvestKg: number
  approvedKg: number
  distributedKg: number
  paaKg: number
}

function buildBuckets(
  from: Date,
  to: Date,
  g: SeriesGranularity,
): Map<string, BucketAcc> {
  const map = new Map<string, BucketAcc>()
  const fromParts = brasiliaCivilParts(from)
  const toParts = brasiliaCivilParts(to)

  let cursor = bucketStartFromParts(fromParts.y, fromParts.m, fromParts.d, g)
  const end = bucketStartFromParts(toParts.y, toParts.m, toParts.d, g)

  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10)
    map.set(key, {
      bucket: key,
      label: bucketLabel(cursor, g),
      donationsKg: 0,
      harvestKg: 0,
      approvedKg: 0,
      distributedKg: 0,
      paaKg: 0,
    })
    if (g === 'day') cursor = new Date(cursor.getTime() + MS_PER_DAY)
    else if (g === 'week') cursor = new Date(cursor.getTime() + 7 * MS_PER_DAY)
    else cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return map
}
