import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireView } from '@/lib/auth-helpers';
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters';

export async function GET(req: NextRequest) {
  const auth = await requireView('indicadores');
  if (auth instanceof NextResponse) return auth;

  const q = parseIndicadoresQuery(req);
  const erro = validatePeriodo(q);
  if (erro) return NextResponse.json({ error: erro }, { status: 400 });

  // ⚠️ FIX: antes usava toDate.setHours(23,59,59,999) — fuso da MÁQUINA.
  //    Em produção (UTC) cortava o último dia em Brasília. Agora as bordas
  //    vêm de day-boundaries, idênticas às demais rotas.
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (q.from) dateFilter.gte = q.from;
  if (q.to) dateFilter.lte = q.to;
  const whereDate = Object.keys(dateFilter).length ? { date: dateFilter } : {};

  const [donations, distributions, harvests] = await Promise.all([
    prisma.donation.findMany({
      where: {
        ...whereDate,
        ...(q.doadorIds ? { donorId: { in: q.doadorIds } } : {}),
      },
      select: { date: true, items: { select: { quantity: true } } },
    }),
    prisma.distribution.findMany({
      where: {
        ...whereDate,
        ...(q.beneficiarioIds
          ? { beneficiaryId: { in: q.beneficiarioIds } }
          : {}),
      },
      select: { date: true, items: { select: { quantity: true } } },
    }),
    prisma.solidarityHarvest.findMany({
      where: {
        ...whereDate,
        ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
      },
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

  const sum = (items: { quantity: number }[]) =>
    items.reduce((a, i) => a + (i.quantity ?? 0), 0);

  for (const d of donations)
    ensure(monthKey(new Date(d.date))).doacoes += sum(d.items);
  for (const d of distributions)
    ensure(monthKey(new Date(d.date))).distribuicoes += sum(d.items);
  for (const h of harvests)
    ensure(monthKey(new Date(h.date))).colheita += sum(h.items);

  const round = (n: number) => Math.round(n * 10) / 10;

  const data = Array.from(map.values())
    .map((d) => ({
      mes: d.mes,
      doacoes: round(d.doacoes),
      distribuicoes: round(d.distribuicoes),
      colheita: round(d.colheita),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return NextResponse.json(data);
}
