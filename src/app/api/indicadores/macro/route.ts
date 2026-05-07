import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireView } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  const auth = await requireView('estoque');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }
  const hasDate = Object.keys(dateFilter).length > 0;
  const whereDate = hasDate ? { date: dateFilter } : {};

  // Soma doações no período
  const donations = await prisma.donationItem.aggregate({
    where: hasDate ? { donation: { date: dateFilter } } : {},
    _sum: { quantity: true },
  });

  // Soma distribuições no período
  const distributions = await prisma.distributionItem.aggregate({
    where: hasDate ? { distribution: { date: dateFilter } } : {},
    _sum: { quantity: true },
  });

  // Soma colheitas no período (SolidarityHarvest)
  const harvests = await prisma.harvestItem.aggregate({
    where: hasDate ? { harvest: { date: dateFilter } } : {},
    _sum: { quantity: true },
  });

  // Câmara fria atual = TODAS aprovações - TODAS distribuições (acumulado)
  const allApprovals = await prisma.dailyApproval.aggregate({
    _sum: { approvedQty: true },
  });
  const allDistributions = await prisma.distributionItem.aggregate({
    _sum: { quantity: true },
  });
  const camaraFriaAtual =
    (allApprovals._sum?.approvedQty ?? 0) -
    (allDistributions._sum?.quantity ?? 0);

  // Aproveitado no período
  const approvalsPeriod = await prisma.dailyApproval.aggregate({
    where: whereDate,
    _sum: { approvedQty: true },
  });

  const totalDoado = donations._sum?.quantity ?? 0;
  const totalDistribuido = distributions._sum?.quantity ?? 0;
  const totalColheita = harvests._sum?.quantity ?? 0;
  const aproveitado =
    (approvalsPeriod._sum?.approvedQty ?? 0) + totalDistribuido;

  const percentualAproveitamento =
    totalDoado > 0 ? (aproveitado / totalDoado) * 100 : 0;

  // Beneficiários únicos atendidos no período
  const beneficiariosUnicos = await prisma.distribution.findMany({
    where: whereDate,
    select: { beneficiaryId: true },
    distinct: ['beneficiaryId'],
  });

  return NextResponse.json({
    totalDoado,
    totalDistribuido,
    totalColheita,
    emEstoque: Math.max(0, camaraFriaAtual),
    percentualAproveitamento: Math.round(percentualAproveitamento * 10) / 10,
    beneficiariosAtendidos: beneficiariosUnicos.length,
  });
}
