import { prisma } from '@/lib/prisma';
import {
  parseYMDtoBrasiliaStart,
  parseYMDtoBrasiliaEnd,
} from '@/lib/date/day-boundaries';

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export interface IndicadoresData {
  periodo: { from: string | null; to: string | null };
  censurado: boolean;
  macro: {
    totalDoado: number;
    totalDistribuido: number;
    totalColheita: number;
    emEstoque: number;
    percentualAproveitamento: number;
    beneficiariosAtendidos: number;
  };
  /** 🌾 ONDA 23.7e-1 — bloco PAA */
  paa: {
    totalKg: number;
    totalEntregas: number;
    produtoresAtivos: number;
    /** null quando censurado — fail-secure, nunca zero */
    totalValor: number | null;
  };
  tendencia: Array<{
    mes: string;
    doacoes: number;
    distribuicoes: number;
    colheita: number;
    paa: number;
  }>;
  topProdutos: Array<{ nome: string; total: number }>;
  topDoadores: Array<{ nome: string; total: number }>;
  topBeneficiarios: Array<{ nome: string; total: number }>;
  topProdutores: Array<{ nome: string; total: number }>;
  /** 🌾 PAA — produtos entregues (kg) */
  topProdutosPaa: Array<{ nome: string; total: number }>;
  topProdutosPaaOrganicos: Array<{ nome: string; total: number }>;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function maskName(name: string): string {
  if (!name) return '***';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '***';
  return parts.map((p, i) => (i === 0 ? p[0] + '***' : p[0] + '.')).join(' ');
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const sumQty = (items: { quantity: number }[]) =>
  items.reduce((a, i) => a + (i.quantity ?? 0), 0);

/** Decimal do Prisma → number na borda. Nunca vaza Decimal pro JSON. */
const dec = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'toNumber' in (v as object)) {
    return (v as { toNumber(): number }).toNumber();
  }
  return Number(v) || 0;
};

/** Top-N a partir de um Map nome→total */
function topN(
  map: Map<string, number>,
  limite = 10,
  transform: (n: string) => string = (n) => n,
): Array<{ nome: string; total: number }> {
  return Array.from(map.entries())
    .map(([nome, total]) => ({ nome: transform(nome), total: round1(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

/* ------------------------------------------------------------------ */
/* Coleta principal                                                    */
/* ------------------------------------------------------------------ */

export async function getIndicadoresData(opts: {
  from: string | null;
  to: string | null;
  censurar: boolean;
}): Promise<IndicadoresData> {
  const { from, to, censurar } = opts;

  // 🇧🇷 Fronteira de dia em horário de Brasília (UTC−3)
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = parseYMDtoBrasiliaStart(from);
  if (to) dateFilter.lte = parseYMDtoBrasiliaEnd(to);

  const hasDate = Object.keys(dateFilter).length > 0;
  const whereDate = hasDate ? { date: dateFilter } : {};
  // 🌾 PAA usa `dataEntrega`, não `date`
  const wherePaa = hasDate ? { dataEntrega: dateFilter } : {};

  const applyMask = (nome: string) => (censurar ? maskName(nome) : nome);

  /* ============================ MACRO ============================ */
  const [
    donationsAgg,
    distributionsAgg,
    harvestsAgg,
    allApprovals,
    allDistributions,
    approvalsPeriod,
    beneficiariosUnicos,
  ] = await Promise.all([
    prisma.donationItem.aggregate({
      where: hasDate ? { donation: { date: dateFilter } } : {},
      _sum: { quantity: true },
    }),
    prisma.distributionItem.aggregate({
      where: hasDate ? { distribution: { date: dateFilter } } : {},
      _sum: { quantity: true },
    }),
    prisma.harvestItem.aggregate({
      where: hasDate ? { harvest: { date: dateFilter } } : {},
      _sum: { quantity: true },
    }),
    prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
    prisma.distributionItem.aggregate({ _sum: { quantity: true } }),
    prisma.dailyApproval.aggregate({
      where: whereDate,
      _sum: { approvedQty: true },
    }),
    prisma.distribution.findMany({
      where: whereDate,
      select: { beneficiaryId: true },
      distinct: ['beneficiaryId'],
    }),
  ]);

  const totalDoado = donationsAgg._sum?.quantity ?? 0;
  const totalDistribuido = distributionsAgg._sum?.quantity ?? 0;
  const totalColheita = harvestsAgg._sum?.quantity ?? 0;
  const camaraFriaAtual =
    (allApprovals._sum?.approvedQty ?? 0) -
    (allDistributions._sum?.quantity ?? 0);
  const aproveitado =
    (approvalsPeriod._sum?.approvedQty ?? 0) + totalDistribuido;
  const percentualAproveitamento =
    totalDoado > 0 ? (aproveitado / totalDoado) * 100 : 0;

  const macro = {
    totalDoado: round1(totalDoado),
    totalDistribuido: round1(totalDistribuido),
    totalColheita: round1(totalColheita),
    emEstoque: Math.max(0, round1(camaraFriaAtual)),
    percentualAproveitamento: round1(percentualAproveitamento),
    beneficiariosAtendidos: beneficiariosUnicos.length,
  };

  /* ============================= PAA ============================= */
  // Uma leitura só, reaproveitada em card, tendência e rankings.
  const entregasPaa = await prisma.entregaPaa.findMany({
    where: wherePaa,
    select: {
      id: true,
      dataEntrega: true,
      producerId: true,
      valorTotal: true,
      itens: {
        select: {
          pesoKg: true,
          tipoCultivo: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  let paaTotalKg = 0;
  let paaTotalValor = 0;
  const paaProdutores = new Set<string>();
  const paaProdMap = new Map<string, number>();
  const paaOrgMap = new Map<string, number>();

  for (const e of entregasPaa) {
    paaProdutores.add(e.producerId);
    paaTotalValor += dec(e.valorTotal);
    for (const i of e.itens) {
      const kg = dec(i.pesoKg);
      paaTotalKg += kg;
      const nome = i.product?.name ?? 'Sem produto';
      paaProdMap.set(nome, (paaProdMap.get(nome) ?? 0) + kg);
      if (i.tipoCultivo === 'ORGANICO') {
        paaOrgMap.set(nome, (paaOrgMap.get(nome) ?? 0) + kg);
      }
    }
  }

  const paa = {
    totalKg: round3(paaTotalKg),
    totalEntregas: entregasPaa.length,
    produtoresAtivos: paaProdutores.size,
    // 🔒 Máscara financeira antecipada da 23.8
    totalValor: censurar ? null : round1(paaTotalValor),
  };

  const topProdutosPaa = topN(paaProdMap);
  const topProdutosPaaOrganicos = topN(paaOrgMap);

  /* ========================== TENDÊNCIA ========================== */
  const [donations, distributions, harvests] = await Promise.all([
    prisma.donation.findMany({
      where: whereDate,
      select: { date: true, items: { select: { quantity: true } } },
    }),
    prisma.distribution.findMany({
      where: whereDate,
      select: { date: true, items: { select: { quantity: true } } },
    }),
    prisma.solidarityHarvest.findMany({
      where: whereDate,
      select: { date: true, items: { select: { quantity: true } } },
    }),
  ]);

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  type Bucket = {
    mes: string;
    doacoes: number;
    distribuicoes: number;
    colheita: number;
    paa: number;
  };
  const map = new Map<string, Bucket>();
  const ensure = (key: string): Bucket => {
    if (!map.has(key))
      map.set(key, {
        mes: key,
        doacoes: 0,
        distribuicoes: 0,
        colheita: 0,
        paa: 0,
      });
    return map.get(key)!;
  };

  for (const d of donations)
    ensure(monthKey(new Date(d.date))).doacoes += sumQty(d.items);
  for (const d of distributions)
    ensure(monthKey(new Date(d.date))).distribuicoes += sumQty(d.items);
  for (const h of harvests)
    ensure(monthKey(new Date(h.date))).colheita += sumQty(h.items);
  for (const e of entregasPaa) {
    const bucket = ensure(monthKey(new Date(e.dataEntrega)));
    for (const i of e.itens) bucket.paa += dec(i.pesoKg);
  }

  const tendencia = Array.from(map.values())
    .map((d) => ({
      mes: d.mes,
      doacoes: round1(d.doacoes),
      distribuicoes: round1(d.distribuicoes),
      colheita: round1(d.colheita),
      paa: round1(d.paa),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  /* =========================== RANKINGS ========================== */
  const [produtosItems, doadoresDon, beneficiariosDist, produtoresHarv] =
    await Promise.all([
      prisma.donationItem.findMany({
        where: hasDate ? { donation: { date: dateFilter } } : {},
        select: { quantity: true, product: { select: { name: true } } },
      }),
      prisma.donation.findMany({
        where: hasDate ? { date: dateFilter } : {},
        select: {
          donor: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.distribution.findMany({
        where: hasDate ? { date: dateFilter } : {},
        select: {
          beneficiary: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
      prisma.solidarityHarvest.findMany({
        where: hasDate ? { date: dateFilter } : {},
        select: {
          producer: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      }),
    ]);

  // Top produtos (produto não é dado sensível — sem máscara)
  const prodMap = new Map<string, number>();
  for (const i of produtosItems) {
    const k = i.product?.name ?? 'Sem produto';
    prodMap.set(k, (prodMap.get(k) ?? 0) + (i.quantity ?? 0));
  }
  const topProdutos = topN(prodMap);

  // Top doadores (mascarável)
  const doadorMap = new Map<string, number>();
  for (const d of doadoresDon) {
    const k = d.donor?.name ?? 'Sem doador';
    doadorMap.set(k, (doadorMap.get(k) ?? 0) + sumQty(d.items));
  }
  const topDoadores = topN(doadorMap, 10, applyMask);

  // Top beneficiários (mascarável)
  const benefMap = new Map<string, number>();
  for (const d of beneficiariosDist) {
    const k = d.beneficiary?.name ?? 'Sem beneficiário';
    benefMap.set(k, (benefMap.get(k) ?? 0) + sumQty(d.items));
  }
  const topBeneficiarios = topN(benefMap, 10, applyMask);

  // Top produtores (mascarável)
  const prodtMap = new Map<string, number>();
  for (const h of produtoresHarv) {
    const k = h.producer?.name ?? 'Sem produtor';
    prodtMap.set(k, (prodtMap.get(k) ?? 0) + sumQty(h.items));
  }
  const topProdutores = topN(prodtMap, 10, applyMask);

  return {
    periodo: { from, to },
    censurado: censurar,
    macro,
    paa,
    tendencia,
    topProdutos,
    topDoadores,
    topBeneficiarios,
    topProdutores,
    topProdutosPaa,
    topProdutosPaaOrganicos,
  };
}
