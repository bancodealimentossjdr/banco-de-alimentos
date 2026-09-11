// src/lib/paa/cota.ts
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

/**
 * 💰 Cota PAA — fonte ÚNICA de verdade do cálculo.
 *
 * Nenhuma rota recalcula cota por conta própria. Se a regra mudar
 * (ciclo anual, modalidades), muda AQUI e em nenhum outro lugar.
 *
 * ♻️ Consumo = SUM(valorTotal) das entregas criadas APÓS o último marco
 *    de reset aplicável (específico do produtor OU global, o mais recente).
 *    Sem marco → soma tudo.
 *
 * ⏳ Ciclo (ano civil / 12m móvel) ainda NÃO implementado — decisão pendente.
 *    O gancho é `cicloFrom` abaixo: quando definido, entra como segundo
 *    filtro de data sem alterar a assinatura pública.
 */

export const COTA_FALLBACK = 15000

export interface CotaInfo {
  producerId: string
  /** Teto aplicável em R$ (override do produtor ou padrão global). */
  teto: number
  /** Consumido em R$ desde o último reset. */
  usado: number
  /** teto - usado, nunca abaixo de 0 para exibição. */
  saldo: number
  /** 0–100+ (pode passar de 100 em estouro). */
  percentual: number
  /** Origem do teto — útil para a UI sinalizar exceção. */
  origemTeto: 'override' | 'global'
  overrideNota: string | null
  status: 'ok' | 'alerta' | 'estourado'
  alertaPercentual: number
  ultimoResetAt: Date | null
}

/* ------------------------------------------------------------------ */
/* Config global (linha única, com fallback defensivo)                 */
/* ------------------------------------------------------------------ */
export async function getPaaConfig() {
  const cfg = await prisma.paaConfig.findUnique({ where: { id: 'default' } })
  return {
    cotaPadrao: cfg ? Number(cfg.cotaPadrao) : COTA_FALLBACK,
    alertaPercentual: cfg?.alertaPercentual ?? 80,
  }
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * 🔍 Marco de reset vigente: o mais recente entre
 *    (reset deste produtor) e (reset global).
 */
async function ultimoReset(producerId: string): Promise<Date | null> {
  const m = await prisma.paaCotaReset.findFirst({
    where: { OR: [{ producerId }, { producerId: null }] },
    orderBy: { resetAt: 'desc' },
    select: { resetAt: true },
  })
  return m?.resetAt ?? null
}

/* ------------------------------------------------------------------ */
/* Cota de UM produtor                                                 */
/* ------------------------------------------------------------------ */
export async function getCotaProdutor(
  producerId: string,
  opts?: { cicloFrom?: Date },
): Promise<CotaInfo> {
  const [cfg, producer, resetAt] = await Promise.all([
    getPaaConfig(),
    prisma.producer.findUnique({
      where: { id: producerId },
      select: { cotaOverride: true, cotaOverrideNota: true },
    }),
    ultimoReset(producerId),
  ])

  const teto =
    producer?.cotaOverride != null
      ? Number(producer.cotaOverride)
      : cfg.cotaPadrao

  // 📅 Corte por createdAt (ato de lançamento), não por dataEntrega.
  const createdAtFilter: Prisma.DateTimeFilter = {}
  if (resetAt) createdAtFilter.gte = resetAt
  if (opts?.cicloFrom) {
    createdAtFilter.gte =
      resetAt && resetAt > opts.cicloFrom ? resetAt : opts.cicloFrom
  }

  const agg = await prisma.entregaPaa.aggregate({
    where: {
      producerId,
      ...(Object.keys(createdAtFilter).length
        ? { createdAt: createdAtFilter }
        : {}),
    },
    _sum: { valorTotal: true },
  })

  const usado = r2(Number(agg._sum.valorTotal ?? 0))
  const percentual = teto > 0 ? r2((usado / teto) * 100) : 0

  return {
    producerId,
    teto: r2(teto),
    usado,
    saldo: r2(Math.max(teto - usado, 0)),
    percentual,
    origemTeto: producer?.cotaOverride != null ? 'override' : 'global',
    overrideNota: producer?.cotaOverrideNota ?? null,
    status:
      usado > teto
        ? 'estourado'
        : percentual >= cfg.alertaPercentual
          ? 'alerta'
          : 'ok',
    alertaPercentual: cfg.alertaPercentual,
    ultimoResetAt: resetAt,
  }
}

/**
 * 📊 Cota de TODOS os produtores PAA — 3 queries, sem N+1.
 *    Usada no seletor de produtor e no painel de cotas.
 */
export async function getCotasTodos(): Promise<
  (CotaInfo & { nome: string })[]
> {
  const cfg = await getPaaConfig()

  const [produtores, resets, somas] = await Promise.all([
    prisma.producer.findMany({
      // 🙈 atendePaa=false apenas OCULTA (não bloqueia lançamento).
      where: { atendePaa: true, active: true },
      select: {
        id: true,
        name: true,
        cotaOverride: true,
        cotaOverrideNota: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.paaCotaReset.findMany({
      orderBy: { resetAt: 'desc' },
      select: { producerId: true, resetAt: true },
    }),
    prisma.entregaPaa.groupBy({
      by: ['producerId'],
      _sum: { valorTotal: true },
      _max: { createdAt: true },
    }),
  ])

  // Marco global mais recente (producerId null).
  const resetGlobal = resets.find((r) => r.producerId === null)?.resetAt ?? null
  const resetPorProdutor = new Map<string, Date>()
  for (const r of resets) {
    if (r.producerId && !resetPorProdutor.has(r.producerId))
      resetPorProdutor.set(r.producerId, r.resetAt)
  }

  // ⚠️ groupBy não aceita corte por reset individual. Quando existe QUALQUER
  //    marco, recalculamos só os produtores afetados — precisão > atalho.
  const somaBruta = new Map(
    somas.map((s) => [s.producerId, Number(s._sum.valorTotal ?? 0)]),
  )

  const afetados = produtores
    .map((p) => p.id)
    .filter((id) => resetGlobal || resetPorProdutor.has(id))

  const recalculados = new Map<string, number>()
  if (afetados.length) {
    const detalhe = await prisma.entregaPaa.findMany({
      where: { producerId: { in: afetados } },
      select: { producerId: true, valorTotal: true, createdAt: true },
    })
    for (const e of detalhe) {
      const corte = resetPorProdutor.get(e.producerId) ?? resetGlobal
      const corteFinal =
        resetGlobal && corte && resetGlobal > corte ? resetGlobal : corte
      if (corteFinal && e.createdAt < corteFinal) continue
      recalculados.set(
        e.producerId,
        (recalculados.get(e.producerId) ?? 0) + Number(e.valorTotal),
      )
    }
    for (const id of afetados)
      if (!recalculados.has(id)) recalculados.set(id, 0)
  }

  return produtores.map((p) => {
    const teto =
      p.cotaOverride != null ? Number(p.cotaOverride) : cfg.cotaPadrao
    const usado = r2(recalculados.get(p.id) ?? somaBruta.get(p.id) ?? 0)
    const percentual = teto > 0 ? r2((usado / teto) * 100) : 0
    const corte = resetPorProdutor.get(p.id) ?? resetGlobal

    return {
      producerId: p.id,
      nome: p.name,
      teto: r2(teto),
      usado,
      saldo: r2(Math.max(teto - usado, 0)),
      percentual,
      origemTeto: (p.cotaOverride != null ? 'override' : 'global') as
        | 'override'
        | 'global',
      overrideNota: p.cotaOverrideNota ?? null,
      status:
        usado > teto
          ? ('estourado' as const)
          : percentual >= cfg.alertaPercentual
            ? ('alerta' as const)
            : ('ok' as const),
      alertaPercentual: cfg.alertaPercentual,
      ultimoResetAt: corte ?? null,
    }
  })
}

/**
 * 🛡️ Checagem pré-lançamento. Retorna o impacto da entrega na cota.
 *    NÃO bloqueia — quem decide é a rota (regra: avisa e permite).
 */
export async function checarImpacto(producerId: string, valorNovo: number) {
  const cota = await getCotaProdutor(producerId)
  const usadoDepois = r2(cota.usado + valorNovo)
  return {
    ...cota,
    valorNovo: r2(valorNovo),
    usadoDepois,
    estoura: usadoDepois > cota.teto,
    excedente: r2(Math.max(usadoDepois - cota.teto, 0)),
  }
}
