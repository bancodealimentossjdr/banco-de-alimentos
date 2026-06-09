import { prisma } from '@/lib/prisma'
import { calculateStock } from '@/lib/stock/calculate-stock'
import { startOfDayBrasilia } from '@/lib/date/day-boundaries'

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

  // true se QUALQUER filtro de entidade estiver ativo
  // (doador / produtor / instituição / funcionário)
  hasEntityFilter: boolean

  volumes: {
    donationsKg: number // doações no período + filtros
    harvestKg: number // colheitas "realizada" no período + filtros
    distributedKg: number // distribuições no período + filtros
  }

  // ⚠️ null quando hasEntityFilter = true (vira hífen na tela)
  utilization: {
    approvedKg: number | null // DailyApproval (não inclui colheita)
    utilizationPct: number | null // taxa de aproveitamento
    destinationPct: number | null // taxa de destinação
    lossKg: number | null // perda derivada (só sobre doação bruta)
    currentStockKg: number | null
  }

  calculatedAt: Date
}

/* ------------------------------------------------------------------ */
/* 🆕 Tipos da SÉRIE TEMPORAL (Onda 16.5.B)                            */
/* ------------------------------------------------------------------ */

export type SeriesGranularity = 'day' | 'week' | 'month'

export type UtilizationSeriesPoint = {
  // chave do bucket (YYYY-MM-DD = início do bucket em horário de Brasília)
  bucket: string
  // label amigável pré-formatado pro eixo X (pt-BR)
  label: string
  donationsKg: number // doação bruta no bucket
  harvestKg: number // colheita "realizada" no bucket
  approvedKg: number // DailyApproval no bucket
  // 🌾 aproveitado TOTAL = approved + colheita (decisão: colheita 100%)
  approvedTotalKg: number
  distributedKg: number // distribuição no bucket
  lossKg: number // perda = max(0, doação - approved)
}

export type UtilizationSeries = {
  period: { from: Date; to: Date }
  granularity: SeriesGranularity
  // ⚠️ true quando há filtro de entidade → série vazia (taxas não atribuíveis)
  hasEntityFilter: boolean
  points: UtilizationSeriesPoint[]
  calculatedAt: Date
}

/* ------------------------------------------------------------------ */
/* Constantes                                                          */
/* ------------------------------------------------------------------ */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ */
/* Snapshot / Série vazios (defesa)                                    */
/* ------------------------------------------------------------------ */

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
  calculatedAt: new Date(),
})

/* ------------------------------------------------------------------ */
/* Função principal — SNAPSHOT (inalterada)                            */
/* ------------------------------------------------------------------ */

export async function calculateUtilization(
  filters: UtilizationFilters,
): Promise<UtilizationSnapshot> {
  const { from, to } = filters

  // normaliza arrays vazios -> undefined (filtro inativo)
  const donorIds = nonEmpty(filters.donorIds)
  const producerIds = nonEmpty(filters.producerIds)
  const beneficiaryIds = nonEmpty(filters.beneficiaryIds)
  const employeeIds = nonEmpty(filters.employeeIds)

  const hasEntityFilter = Boolean(
    donorIds || producerIds || beneficiaryIds || employeeIds,
  )

  // 🛡️ Defesa: se o client ainda não conhece os models (cache velho),
  // retorna snapshot vazio em vez de quebrar a página.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).donationItem || !(prisma as any).dailyApproval) {
    console.warn(
      '[calculateUtilization] prisma indisponível. ' +
        'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SNAPSHOT(from, to, hasEntityFilter)
  }

  try {
    // ----------------------------------------------------------------
    // Filtro de funcionário: o nome pode estar em 3 slots distintos.
    // Construímos um OR reutilizável para cada model.
    // ----------------------------------------------------------------
    const employeeOR = employeeIds
      ? {
          OR: [
            { employeeId: { in: employeeIds } },
            { employee2Id: { in: employeeIds } },
            { employee3Id: { in: employeeIds } },
          ],
        }
      : {}

    // ----------------------------------------------------------------
    // WHERE de cada model (período sempre; entidades quando ativas)
    // ----------------------------------------------------------------
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

    // ----------------------------------------------------------------
    // VOLUMES — sempre calculados, com todos os filtros ativos
    // ----------------------------------------------------------------
    const [donationItems, harvestItems, distributionItems] = await Promise.all([
      prisma.donationItem.findMany({
        where: { donation: donationWhere },
        select: { quantity: true },
      }),
      prisma.harvestItem.findMany({
        where: { harvest: harvestWhere },
        select: { quantity: true },
      }),
      prisma.distributionItem.findMany({
        where: { distribution: distributionWhere },
        select: { quantity: true },
      }),
    ])

    const donationsKg = round3(sumQty(donationItems))
    const harvestKg = round3(sumQty(harvestItems))
    const distributedKg = round3(sumQty(distributionItems))

    const volumes = { donationsKg, harvestKg, distributedKg }

    // ----------------------------------------------------------------
    // UTILIZATION — só faz sentido na VISÃO GERAL.
    // Com qualquer filtro de entidade ativo, vira null (hífen na tela).
    // ----------------------------------------------------------------
    if (hasEntityFilter) {
      return {
        period: { from, to },
        hasEntityFilter: true,
        volumes,
        utilization: {
          approvedKg: null,
          utilizationPct: null,
          destinationPct: null,
          lossKg: null,
          currentStockKg: null,
        },
        calculatedAt: new Date(),
      }
    }

    // ---- Visão geral: aproveitamento agregado (DailyApproval) ----
    // DailyApproval.date é @db.Date (meia-noite UTC). O range
    // [from .. to] em fronteira Brasília cobre o dia inteiro corretamente.
    const approvalAgg = await prisma.dailyApproval.aggregate({
      where: { date: { gte: from, lte: to } },
      _sum: { approvedQty: true },
    })

    const approvedKg = round3(approvalAgg._sum.approvedQty ?? 0)

    // ----------------------------------------------------------------
    // 🧮 FÓRMULAS OFICIAIS (Onda 16.5)
    //
    // Entradas aproveitáveis = doação bruta + colheita realizada
    // Aproveitado TOTAL      = DailyApproval + colheita (100% aproveitada)
    //
    // A colheita é 100% aproveitada (decisão travada do checkpoint):
    // entra como ENTRADA e como APROVEITADO ao mesmo tempo.
    // ----------------------------------------------------------------
    const entradasKg = round3(donationsKg + harvestKg)
    const aproveitadoTotalKg = round3(approvedKg + harvestKg)

    // 📊 Taxa de aproveitamento:
    //    (Aprov + Colheita) / (Doação bruta + Colheita) × 100
    //    → "De tudo que entrou, quanto foi salvo do lixo?"
    const utilizationPct =
      entradasKg > 0 ? round1((aproveitadoTotalKg / entradasKg) * 100) : 0

    // 📤 Taxa de destinação:
    //    Distribuído / (Aprov + Colheita) × 100
    //    → "De tudo que aproveitei, quanto já saiu pro beneficiário?"
    const destinationPct =
      aproveitadoTotalKg > 0
        ? round1((distributedKg / aproveitadoTotalKg) * 100)
        : 0

    // 🗑️ Perda = Doação bruta − Aproveitamento (nunca negativo).
    //    Colheita NÃO gera perda (é 100% aproveitada), por isso o
    //    denominador da perda é só a doação bruta.
    //    Consistência: perda = entradas − aproveitadoTotal = doação − approved
    const lossKg = round3(Math.max(0, donationsKg - approvedKg))

    // 📦 Estoque atual: reutiliza a lib oficial (parte do último marco)
    const stock = await calculateStock(to)
    const currentStockKg = stock.hasMarker ? stock.currentStockKg : null

    return {
      period: { from, to },
      hasEntityFilter: false,
      volumes,
      utilization: {
        approvedKg,
        utilizationPct,
        destinationPct,
        lossKg,
        currentStockKg,
      },
      calculatedAt: new Date(),
    }
  } catch (error) {
    console.error('[calculateUtilization] Erro inesperado:', error)
    return EMPTY_SNAPSHOT(from, to, hasEntityFilter)
  }
}

/* ------------------------------------------------------------------ */
/* 🆕 Função SÉRIE TEMPORAL (Onda 16.5.B)                              */
/*                                                                     */
/* Evolução do aproveitado total (DailyApproval + colheita) e dos      */
/* demais volumes, agrupados por dia/semana/mês em horário de Brasília.*/
/*                                                                     */
/* Granularidade (auto):                                               */
/*   ≤ 31 dias → 'day'   |   ≤ 92 dias → 'week'   |   > 92 → 'month'    */
/*                                                                     */
/* ⚠️ DailyApproval não tem entidade → série só na VISÃO GERAL.        */
/*                                                                     */
/* 🇧🇷 FONTE ÚNICA DE FRONTEIRA: as chaves de bucket derivam de         */
/*    startOfDayBrasilia (day-boundaries.ts). Movimentações (DateTime)  */
/*    usam bucketKey (com offset); aprovações (@db.Date) usam           */
/*    bucketKeyDateOnly (sem offset, pois o dia civil já é absoluto).   */
/*    Ambas resultam na MESMA chave de dia civil → Σ série == snapshot. */
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

  const granularity = pickGranularity(from, to)

  // 🛡️ Defesa de cache do client Prisma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(prisma as any).donationItem || !(prisma as any).dailyApproval) {
    console.warn(
      '[calculateUtilizationSeries] prisma indisponível. ' +
        'Rode: npx prisma generate && restart do dev server.',
    )
    return EMPTY_SERIES(from, to, granularity, hasEntityFilter)
  }

  // ⚠️ Série só na visão geral (aproveitado não é atribuível a entidade)
  if (hasEntityFilter) {
    return EMPTY_SERIES(from, to, granularity, true)
  }

  try {
    // ----------------------------------------------------------------
    // Busca crua com as DATAS (agrupamos por bucket no JS).
    // ----------------------------------------------------------------
    const [donationItems, harvestItems, distributionItems, approvalRows] =
      await Promise.all([
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
      ])

    // ----------------------------------------------------------------
    // Esqueleto de buckets (todos zerados) — dias/semanas/meses sem
    // dado aparecem como 0 na linha.
    // ----------------------------------------------------------------
    const buckets = buildBuckets(from, to, granularity)

    // 🇧🇷 Movimentações DateTime → bucket em horário de Brasília.
    //    bucketKey aplica o offset (startOfDayBrasilia) e gera o dia civil.
    const addLocal = (
      date: Date,
      field: 'donationsKg' | 'harvestKg' | 'distributedKg',
      qty: number,
    ) => {
      const key = bucketKey(date, granularity)
      const point = buckets.get(key)
      if (point) point[field] = round3(point[field] + qty)
    }

    // 📅 DailyApproval é @db.Date: o valor JÁ É o dia civil (meia-noite UTC).
    //    NÃO aplicar offset Brasília aqui (deslocaria 1 dia pra trás).
    //    bucketKeyDateOnly lê os componentes UTC direto → mesma chave do
    //    esqueleto e das movimentações do mesmo dia civil.
    const addApproval = (date: Date, qty: number) => {
      const key = bucketKeyDateOnly(date, granularity)
      const point = buckets.get(key)
      if (point) point.approvedKg = round3(point.approvedKg + qty)
    }

    for (const it of donationItems) {
      addLocal(it.donation.date, 'donationsKg', it.quantity)
    }
    for (const it of harvestItems) {
      addLocal(it.harvest.date, 'harvestKg', it.quantity)
    }
    for (const it of distributionItems) {
      addLocal(it.distribution.date, 'distributedKg', it.quantity)
    }
    for (const ap of approvalRows) {
      addApproval(ap.date, ap.approvedQty)
    }

    // ----------------------------------------------------------------
    // Deriva campos compostos por bucket (mesma lógica das fórmulas)
    // ----------------------------------------------------------------
    const points: UtilizationSeriesPoint[] = Array.from(buckets.values()).map(
      (p) => ({
        bucket: p.bucket,
        label: p.label,
        donationsKg: p.donationsKg,
        harvestKg: p.harvestKg,
        approvedKg: p.approvedKg,
        distributedKg: p.distributedKg,
        // 🌾 colheita 100% aproveitada → entra no aproveitado total
        approvedTotalKg: round3(p.approvedKg + p.harvestKg),
        // 🗑️ perda só sobre doação bruta
        lossKg: round3(Math.max(0, p.donationsKg - p.approvedKg)),
      }),
    )

    return {
      period: { from, to },
      granularity,
      hasEntityFilter: false,
      points,
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

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// arrays vazios ou undefined viram undefined (filtro inativo)
function nonEmpty(arr?: string[]): string[] | undefined {
  return arr && arr.length > 0 ? arr : undefined
}

/* ------------------------------------------------------------------ */
/* 🆕 Helpers da série temporal — FONTE ÚNICA: day-boundaries.ts        */
/* ------------------------------------------------------------------ */

// Escolhe granularidade automaticamente pelo tamanho do período
function pickGranularity(from: Date, to: Date): SeriesGranularity {
  const days = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY) + 1
  if (days <= 31) return 'day'
  if (days <= 92) return 'week'
  return 'month'
}

// 🇧🇷 Componentes "civis" de Brasília de uma data DateTime.
// Reusa a fonte única (startOfDayBrasilia retorna 03:00 UTC = 00:00 BSB),
// e lemos os getters UTC, que já representam o dia civil de Brasília.
function brasiliaCivilParts(date: Date): { y: number; m: number; d: number } {
  const start = startOfDayBrasilia(date) // 03:00 UTC = 00:00 BSB do dia civil
  return {
    y: start.getUTCFullYear(),
    m: start.getUTCMonth(),
    d: start.getUTCDate(),
  }
}

// Início do dia (chave UTC hora 0) a partir de partes civis (y, m, d).
// A hora 0 UTC serve só como identificador estável de bucket — o que
// importa é o YYYY-MM-DD do slice.
function dayKeyFromParts(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
}

// Recua para a segunda-feira da semana do dia informado.
function toMonday(dayStart: Date): Date {
  const s = new Date(dayStart)
  const dow = s.getUTCDay() // 0=domingo .. 6=sábado
  const diff = dow === 0 ? 6 : dow - 1 // segunda como início
  s.setUTCDate(s.getUTCDate() - diff)
  return s
}

// Aplica a granularidade sobre partes civis já resolvidas.
function bucketStartFromParts(
  y: number,
  m: number,
  d: number,
  g: SeriesGranularity,
): Date {
  if (g === 'day') return dayKeyFromParts(y, m, d)
  if (g === 'week') return toMonday(dayKeyFromParts(y, m, d))
  return dayKeyFromParts(y, m, 1) // início do mês
}

// 🇧🇷 Chave de bucket para MOVIMENTAÇÕES (DateTime) → aplica offset Brasília.
function bucketKey(date: Date, g: SeriesGranularity): string {
  const { y, m, d } = brasiliaCivilParts(date)
  return bucketStartFromParts(y, m, d, g).toISOString().slice(0, 10)
}

// 📅 Chave de bucket para @db.Date (DailyApproval) → usa o dia UTC direto,
// SEM offset (o @db.Date já representa o dia civil correto).
function bucketKeyDateOnly(date: Date, g: SeriesGranularity): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth()
  const d = date.getUTCDate()
  return bucketStartFromParts(y, m, d, g).toISOString().slice(0, 10)
}

// Fim do bucket (último dia incluído) — usado só para o label de intervalo.
function bucketEnd(start: Date, g: SeriesGranularity): Date {
  if (g === 'day') return start
  if (g === 'week') {
    return new Date(start.getTime() + 6 * MS_PER_DAY)
  }
  // mês: último dia = dia 0 do mês seguinte
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 0, 0, 0, 0),
  )
}

// Label amigável pro eixo X (pt-BR)
function bucketLabel(start: Date, g: SeriesGranularity): string {
  const fmtDM = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, '0')}/${String(
      d.getUTCMonth() + 1,
    ).padStart(2, '0')}`

  if (g === 'day') return fmtDM(start)

  // 🆕 semana vira INTERVALO: "DD/MM – DD/MM"
  if (g === 'week') {
    const end = bucketEnd(start, g)
    return `${fmtDM(start)} – ${fmtDM(end)}`
  }

  // mês: MM/YYYY
  const mm = String(start.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = start.getUTCFullYear()
  return `${mm}/${yyyy}`
}

// Constrói o Map de buckets do período inteiro, todos zerados.
// O período é interpretado em horário de Brasília (fonte única).
function buildBuckets(
  from: Date,
  to: Date,
  g: SeriesGranularity,
): Map<
  string,
  {
    bucket: string
    label: string
    donationsKg: number
    harvestKg: number
    approvedKg: number
    distributedKg: number
  }
> {
  const map = new Map<
    string,
    {
      bucket: string
      label: string
      donationsKg: number
      harvestKg: number
      approvedKg: number
      distributedKg: number
    }
  >()

  // from/to já vêm em fronteira Brasília (parseYMDtoBrasilia*).
  // O cursor anda pela base civil de Brasília — mesma âncora dos dados.
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
    })

    if (g === 'day') {
      cursor = new Date(cursor.getTime() + MS_PER_DAY)
    } else if (g === 'week') {
      cursor = new Date(cursor.getTime() + 7 * MS_PER_DAY)
    } else {
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      )
    }
  }

  return map
}
