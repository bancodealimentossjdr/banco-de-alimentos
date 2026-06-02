import { prisma } from '@/lib/prisma';

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
  tendencia: Array<{
    mes: string;
    doacoes: number;
    distribuicoes: number;
    colheita: number;
  }>;
  topProdutos: Array<{ nome: string; total: number }>;
  topDoadores: Array<{ nome: string; total: number }>;
  topBeneficiarios: Array<{ nome: string; total: number }>;
  topProdutores: Array<{ nome: string; total: number }>;
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

const sumQty = (items: { quantity: number }[]) =>
  items.reduce((a, i) => a + (i.quantity ?? 0), 0);

/* ------------------------------------------------------------------ */
/* Coleta principal                                                    */
/* ------------------------------------------------------------------ */

export async function getIndicadoresData(opts: {
  from: string | null;
  to: string | null;
  censurar: boolean;
}): Promise<IndicadoresData> {
  const { from, to, censurar } = opts;

  // --- Filtro de data (mesma lógica das rotas em produção) ---
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }
  const hasDate = Object.keys(dateFilter).length > 0;
  const whereDate = hasDate ? { date: dateFilter } : {};

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
  };
  const map = new Map<string, Bucket>();
  const ensure = (key: string): Bucket => {
    if (!map.has(key))
      map.set(key, { mes: key, doacoes: 0, distribuicoes: 0, colheita: 0 });
    return map.get(key)!;
  };

  for (const d of donations)
    ensure(monthKey(new Date(d.date))).doacoes += sumQty(d.items);
  for (const d of distributions)
    ensure(monthKey(new Date(d.date))).distribuicoes += sumQty(d.items);
  for (const h of harvests)
    ensure(monthKey(new Date(h.date))).colheita += sumQty(h.items);

  const tendencia = Array.from(map.values())
    .map((d) => ({
      mes: d.mes,
      doacoes: round1(d.doacoes),
      distribuicoes: round1(d.distribuicoes),
      colheita: round1(d.colheita),
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

  // Top produtos (não tem máscara — produto não é dado sensível)
  const prodMap = new Map<string, number>();
  for (const i of produtosItems) {
    const k = i.product?.name ?? 'Sem produto';
    prodMap.set(k, (prodMap.get(k) ?? 0) + (i.quantity ?? 0));
  }
  const topProdutos = Array.from(prodMap.entries())
    .map(([nome, total]) => ({ nome, total: round1(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Top doadores (mascarável)
  const doadorMap = new Map<string, number>();
  for (const d of doadoresDon) {
    const k = d.donor?.name ?? 'Sem doador';
    doadorMap.set(k, (doadorMap.get(k) ?? 0) + sumQty(d.items));
  }
  const topDoadores = Array.from(doadorMap.entries())
    .map(([nome, total]) => ({ nome: applyMask(nome), total: round1(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Top beneficiários (mascarável)
  const benefMap = new Map<string, number>();
  for (const d of beneficiariosDist) {
    const k = d.beneficiary?.name ?? 'Sem beneficiário';
    benefMap.set(k, (benefMap.get(k) ?? 0) + sumQty(d.items));
  }
  const topBeneficiarios = Array.from(benefMap.entries())
    .map(([nome, total]) => ({ nome: applyMask(nome), total: round1(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Top produtores (mascarável)
  const prodtMap = new Map<string, number>();
  for (const h of produtoresHarv) {
    const k = h.producer?.name ?? 'Sem produtor';
    prodtMap.set(k, (prodtMap.get(k) ?? 0) + sumQty(h.items));
  }
  const topProdutores = Array.from(prodtMap.entries())
    .map(([nome, total]) => ({ nome: applyMask(nome), total: round1(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    periodo: { from, to },
    censurado: censurar,
    macro,
    tendencia,
    topProdutos,
    topDoadores,
    topBeneficiarios,
    topProdutores,
  };
}
