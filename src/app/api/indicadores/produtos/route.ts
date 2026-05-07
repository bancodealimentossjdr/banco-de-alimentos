import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireView } from '@/lib/auth-helpers';

export async function GET() {
  const auth = await requireView('estoque');
  if (auth instanceof NextResponse) return auth;

  const [produtos, doadores, beneficiarios, produtores] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.donor.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.beneficiary.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.producer.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return NextResponse.json({ produtos, doadores, beneficiarios, produtores });
}
