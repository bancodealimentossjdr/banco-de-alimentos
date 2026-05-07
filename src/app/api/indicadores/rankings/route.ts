import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireView } from '@/lib/auth-helpers';

function maskName(name: string) {
  if (!name) return '***';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '***';
  return parts
    .map((p, i) => (i === 0 ? p[0] + '***' : p[0] + '.'))
    .join(' ');
}

export async function GET(req: NextRequest) {
  const auth = await requireView('estoque');
  if (auth instanceof NextResponse) return auth;

  const isViewer = auth.user.role === 'visualizador';

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const type = searchParams.get('type') || 'produtos';

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }
  const hasDate = Object.keys(dateFilter).length > 0;

  if (type === 'produtos') {
    const items = await prisma.donationItem.findMany({
      where: hasDate ? { donation: { date: dateFilter } } : {},
      select: {
        quantity: true,
        product: { select: { name: true } },
      },
    });
    const map = new Map<string, number>();
    for (const i of items) {
      const k = i.product?.name ?? 'Sem produto';
      map.set(k, (map.get(k) ?? 0) + (i.quantity ?? 0));
    }
    const arr = Array.from(map.entries())
      .map(([nome, total]) => ({ nome, total: Math.round(total * 10) / 10 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return NextResponse.json(arr);
  }

  if (type === 'doadores') {
    const donations = await prisma.donation.findMany({
      where: hasDate ? { date: dateFilter } : {},
      select: {
        donor: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    });
    const map = new Map<string, number>();
    for (const d of donations) {
      const k = d.donor?.name ?? 'Sem doador';
      const total = d.items.reduce(
        (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
        0,
      );
      map.set(k, (map.get(k) ?? 0) + total);
    }
    const arr = Array.from(map.entries())
      .map(([nome, total]) => ({
        nome: isViewer ? maskName(nome) : nome,
        total: Math.round(total * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return NextResponse.json(arr);
  }

  if (type === 'beneficiarios') {
    const distributions = await prisma.distribution.findMany({
      where: hasDate ? { date: dateFilter } : {},
      select: {
        beneficiary: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    });
    const map = new Map<string, number>();
    for (const d of distributions) {
      const k = d.beneficiary?.name ?? 'Sem beneficiário';
      const total = d.items.reduce(
        (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
        0,
      );
      map.set(k, (map.get(k) ?? 0) + total);
    }
    const arr = Array.from(map.entries())
      .map(([nome, total]) => ({
        nome: isViewer ? maskName(nome) : nome,
        total: Math.round(total * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return NextResponse.json(arr);
  }

  if (type === 'produtores') {
    const harvests = await prisma.solidarityHarvest.findMany({
      where: hasDate ? { date: dateFilter } : {},
      select: {
        producer: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    });
    const map = new Map<string, number>();
    for (const h of harvests) {
      const k = h.producer?.name ?? 'Sem produtor';
      const total = h.items.reduce(
        (a: number, i: { quantity: number }) => a + (i.quantity ?? 0),
        0,
      );
      map.set(k, (map.get(k) ?? 0) + total);
    }
    const arr = Array.from(map.entries())
      .map(([nome, total]) => ({
        nome: isViewer ? maskName(nome) : nome,
        total: Math.round(total * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    return NextResponse.json(arr);
  }

  return NextResponse.json({ error: 'type inválido' }, { status: 400 });
}
