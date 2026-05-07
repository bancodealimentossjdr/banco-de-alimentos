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

  const [donations, distributions, harvests] = await Promise.all([
    prisma.donation.findMany({
      where: whereDate,
      select: {
        date: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.distribution.findMany({
      where: whereDate,
      select: {
        date: true,
        items: { select: { quantity: true } },
      },
    }),
    prisma.solidarityHarvest.findMany({
      where: whereDate,
      select: {
        date: true,
        items: { select: { quantity: true } },
      },
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

  for (const d of donations) {
    const k = monthKey(new Date(d.date));
    const total = d.items.reduce(
      (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
      0,
    );
    ensure(k).doacoes += total;
  }
  for (const d of distributions) {
    const k = monthKey(new Date(d.date));
    const total = d.items.reduce(
      (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
      0,
    );
    ensure(k).distribuicoes += total;
  }
  for (const h of harvests) {
    const k = monthKey(new Date(h.date));
    const total = h.items.reduce(
      (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
      0,
    );
    ensure(k).colheita += total;
  }

  const data = Array.from(map.values())
    .map((d) => ({
      mes: d.mes,
      doacoes: Math.round(d.doacoes * 10) / 10,
      distribuicoes: Math.round(d.distribuicoes * 10) / 10,
      colheita: Math.round(d.colheita * 10) / 10,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return NextResponse.json(data);
}
