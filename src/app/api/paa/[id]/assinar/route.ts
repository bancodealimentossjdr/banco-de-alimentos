import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireEditRecord, requireDeleteRecord } from '@/lib/auth-helpers'
import { hashEntregaPaa } from '@/lib/paa-hash'

export const dynamic = 'force-dynamic'

// ============================================
// G1-8c — Assinatura da entrega PAA
//
// POST   → assina (RASCUNHO → ASSINADA)
//   - operador: só no dia da entrega (requireEditRecord); admin/dev: sempre
//   - já assinada → 409 (não sobrescreve)
//   - sem itens ou valor ≤ 0 → 400
//   - PNG ≤ ~300 KB
//   - lock otimista por updatedAt (corrida com PUT → 409)
//
// DELETE → retira assinatura (operador: 403 via requireDeleteRecord)
//   - admin: motivo obrigatório; FINALIZADA → 409 (tirar do Termo antes)
//   - dev: qualquer status, motivo opcional; FINALIZADA desvincula do Termo
//   - SEMPRE registra linha de auditoria em observacoes
// ============================================

const MAX_BASE64 = 410_000 // ≈ 300 KB de PNG

const AssinarSchema = z.object({
  assinaturaData: z
    .string({ error: 'Assinatura é obrigatória' })
    .max(MAX_BASE64, 'Assinatura muito grande (máx. 300 KB)')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/, 'Assinatura em formato inválido'),
})

const DesassinarSchema = z.object({
  motivo: z.string().trim().max(500, 'Motivo muito longo').optional().nullable(),
})

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const agoraBR = () =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

// ---------- POST: assinar ----------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const existing = await prisma.entregaPaa.findUnique({
      where: { id },
      select: { dataEntrega: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    // 🔒 Operador: só no dia; admin/dev: liberado
    const authResult = await requireEditRecord('paa', existing.dataEntrega)
    if (authResult instanceof NextResponse) return authResult
    const auth = authResult

    const body = await req.json().catch(() => null)
    const parsed = AssinarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    const { assinaturaData } = parsed.data

    const result = await prisma.$transaction(async (tx) => {
      const e = await tx.entregaPaa.findUnique({ where: { id }, include: { itens: true } })
      if (!e) throw new HttpError(404, 'Entrega não encontrada')
      if (e.status !== 'RASCUNHO') throw new HttpError(409, 'Esta entrega já está assinada.')
      if (e.itens.length === 0 || Number(e.valorTotal) <= 0) {
        throw new HttpError(400, 'Entrega sem itens ou com valor zero não pode ser assinada.')
      }

      const em = new Date()
      const hash = hashEntregaPaa(e, { data: assinaturaData, em, porId: auth.user.id })

      // 🛡️ Lock otimista: se alguém editou entre a leitura e aqui, aborta
      const upd = await tx.entregaPaa.updateMany({
        where: { id, status: 'RASCUNHO', updatedAt: e.updatedAt },
        data: {
          status: 'ASSINADA',
          assinaturaData,
          assinaturaEm: em,
          assinaturaPorId: auth.user.id,
          assinaturaHash: hash,
        },
      })
      if (upd.count === 0) {
        throw new HttpError(409, 'A entrega foi alterada durante a assinatura. Recarregue e tente de novo.')
      }

      return { id, status: 'ASSINADA' as const, assinaturaEm: em, assinaturaHash: hash }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[POST /api/paa/[id]/assinar] erro:', error)
    return NextResponse.json({ error: 'Erro ao assinar entrega' }, { status: 500 })
  }
}

// ---------- DELETE: retirar assinatura ----------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 🚫 Só admin/dev (operador → 403)
  const authResult = await requireDeleteRecord('paa')
  if (authResult instanceof NextResponse) return authResult
  const auth = authResult
  const isDev = auth.user.role === 'dev'

  try {
    const { id } = await params

    const body = await req.json().catch(() => ({}))
    const parsed = DesassinarSchema.safeParse(body ?? {})
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    const motivo = parsed.data.motivo?.trim() || null

    if (!isDev && (!motivo || motivo.length < 5)) {
      return NextResponse.json(
        { error: 'Informe o motivo da retirada (mínimo 5 caracteres).' },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const e = await tx.entregaPaa.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          observacoes: true,
          updatedAt: true,
          termoPaa: { select: { numeroTermo: true } },
        },
      })
      if (!e) throw new HttpError(404, 'Entrega não encontrada')
      if (e.status === 'RASCUNHO') throw new HttpError(409, 'Esta entrega não está assinada.')
      if (e.status === 'FINALIZADA' && !isDev) {
        throw new HttpError(409, 'Entrega vinculada a um Termo. Retire-a do Termo antes de desassinar.')
      }

      const autor = auth.user.name || auth.user.email || auth.user.id
      const partes = [`[${agoraBR()}] Assinatura retirada por ${autor}`]
      if (motivo) partes.push(`motivo: ${motivo}`)
      if (e.termoPaa) partes.push(`desvinculada do Termo ${e.termoPaa.numeroTermo}`)
      const linha = partes.join(' — ')
      const observacoes = e.observacoes ? `${e.observacoes}\n${linha}` : linha

      const upd = await tx.entregaPaa.updateMany({
        where: { id, updatedAt: e.updatedAt },
        data: {
          status: 'RASCUNHO',
          assinaturaData: null,
          assinaturaEm: null,
          assinaturaPorId: null,
          assinaturaHash: null,
          termoPaaId: null,
          observacoes,
        },
      })
      if (upd.count === 0) {
        throw new HttpError(409, 'A entrega foi alterada simultaneamente. Recarregue e tente de novo.')
      }

      return { id, status: 'RASCUNHO' as const, desvinculadaDoTermo: e.termoPaa?.numeroTermo ?? null }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[DELETE /api/paa/[id]/assinar] erro:', error)
    return NextResponse.json({ error: 'Erro ao retirar assinatura' }, { status: 500 })
  }
}
