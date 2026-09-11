// src/app/api/paa/config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

const ROLES_PERMITIDAS = ['admin', 'dev']

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role
  if (!role || !ROLES_PERMITIDAS.includes(role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })

  const data: { cotaPadrao?: number; alertaPercentual?: number } = {}

  if (body.cotaPadrao !== undefined) {
    const v = Number(body.cotaPadrao)
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json(
        { error: 'cotaPadrao deve ser um número positivo.' },
        { status: 400 },
      )
    }
    data.cotaPadrao = v
  }

  if (body.alertaPercentual !== undefined) {
    const v = Number(body.alertaPercentual)
    if (!Number.isInteger(v) || v < 1 || v > 100) {
      return NextResponse.json(
        { error: 'alertaPercentual deve ser inteiro entre 1 e 100.' },
        { status: 400 },
      )
    }
    data.alertaPercentual = v
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nada a atualizar.' }, { status: 400 })
  }

  const cfg = await prisma.paaConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      cotaPadrao: data.cotaPadrao ?? 15000,
      alertaPercentual: data.alertaPercentual ?? 80,
      updatedBy: session!.user!.id,
    },
    update: { ...data, updatedBy: session!.user!.id },
  })

  return NextResponse.json({
    cotaPadrao: Number(cfg.cotaPadrao),
    alertaPercentual: cfg.alertaPercentual,
  })
}
