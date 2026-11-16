// src/app/api/paa/config/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireAdminOrDev } from '@/lib/auth-helpers'
import { paaConfigInstitucionalSchema } from '@/lib/validations/termo-paa'

export const dynamic = 'force-dynamic'

const CAMPOS_INST = [
  'unidadeExecutora',
  'termoAdesao',
  'proposta',
  'planoOperacional',
  'uf',
  'municipio',
] as const

function serialize(cfg: any) {
  return {
    cotaPadrao: Number(cfg?.cotaPadrao ?? 15000),
    alertaPercentual: cfg?.alertaPercentual ?? 80,
    unidadeExecutora: cfg?.unidadeExecutora ?? null,
    termoAdesao: cfg?.termoAdesao ?? null,
    proposta: cfg?.proposta ?? null,
    planoOperacional: cfg?.planoOperacional ?? null,
    uf: cfg?.uf ?? null,
    municipio: cfg?.municipio ?? null,
  }
}

// ---------- GET: config (dados institucionais não são sensíveis) ----------
export async function GET() {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult
  try {
    const cfg = await prisma.paaConfig.findUnique({ where: { id: 'default' } })
    return NextResponse.json(serialize(cfg))
  } catch (error) {
    console.error('[GET /api/paa/config] erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar configuração.' }, { status: 500 })
  }
}

// ---------- PATCH: cota + dados institucionais (admin/dev) ----------
export async function PATCH(req: NextRequest) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult
  const userId = authResult.user.id

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (body.cotaPadrao !== undefined) {
    const v = Number(body.cotaPadrao)
    if (!Number.isFinite(v) || v <= 0) {
      return NextResponse.json({ error: 'cotaPadrao deve ser um número positivo.' }, { status: 400 })
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

  // Só os campos institucionais ENVIADOS (o schema converte ausente em null)
  const enviados = CAMPOS_INST.filter((k) => Object.prototype.hasOwnProperty.call(body, k))
  if (enviados.length) {
    const parsed = paaConfigInstitucionalSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    for (const k of enviados) data[k] = (parsed.data as any)[k] ?? null
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nada a atualizar.' }, { status: 400 })
  }

  try {
    const cfg = await prisma.paaConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        cotaPadrao: 15000,
        alertaPercentual: 80,
        ...data,
        updatedBy: userId,
      },
      update: { ...data, updatedBy: userId },
    })
    return NextResponse.json(serialize(cfg))
  } catch (error) {
    console.error('[PATCH /api/paa/config] erro:', error)
    return NextResponse.json({ error: 'Erro ao salvar configuração.' }, { status: 500 })
  }
}
