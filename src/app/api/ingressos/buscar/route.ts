// src/app/api/ingressos/buscar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const cpf = (req.nextUrl.searchParams.get('cpf') ?? '').replace(/\D/g, '')
  if (cpf.length < 11) {
    return NextResponse.json({ encontrado: false, cpf, reservas: [] })
  }

  const reservas = await prisma.reservaIngresso.findMany({
    where: { cpf },
    include: {
      lote: { select: { showLabel: true, showData: true } },
      retiradoPor: { select: { name: true } },
    },
    orderBy: { lote: { showData: 'asc' } },
  })

  if (reservas.length === 0) {
    return NextResponse.json({ encontrado: false, cpf, reservas: [] })
  }

  const mapped = reservas.map((r) => ({
    id: r.id,
    protocolo: r.protocolo,
    showLabel: r.lote.showLabel,
    showData: r.lote.showData,
    retirado: r.retirado,
    retiradoEm: r.retiradoEm,
    retiradoPorNome: r.retiradoPor?.name ?? null,
  }))

  return NextResponse.json({
    encontrado: true,
    cpf,
    nome: reservas[0].nome,
    reservas: mapped,
    totalDisponiveis: mapped.filter((r) => !r.retirado).length,
    totalRetirados: mapped.filter((r) => r.retirado).length,
  })
}
