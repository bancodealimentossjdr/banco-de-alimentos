import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/auth-helpers'
import { HttpError, recalcularTotaisTermo, agoraBR } from '@/lib/paa/termo'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/paa/termos/[id]/entregas/[entregaId]  { motivo? }
 * Retira a entrega do Termo: FINALIZADA → ASSINADA, recalcula os totais na mesma transação.
 * admin: motivo obrigatório (≥5) · dev: opcional · sempre registra auditoria em observacoes.
 * Termo vazio é mantido (número do SISPAA não se recicla).
 */
const Schema = z.object({
  motivo: z.string().trim().max(500, 'Motivo muito longo').optional().nullable(),
})

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entregaId: string }> },
) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult
  const auth = authResult
  const isDev = auth.user.role === 'dev'

  const body = await req.json().catch(() => ({}))
  const parsed = Schema.safeParse(body ?? {})
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

  try {
    const { id: termoId, entregaId } = await params

    const result = await prisma.$transaction(async (tx) => {
      const e = await tx.entregaPaa.findFirst({
        where: { id: entregaId, termoPaaId: termoId },
        select: {
          id: true,
          observacoes: true,
          updatedAt: true,
          termoPaa: { select: { numeroTermo: true } },
        },
      })
      if (!e) throw new HttpError(404, 'Entrega não encontrada neste Termo.')

      const autor = auth.user.name || auth.user.email || auth.user.id
      const partes = [`[${agoraBR()}] Retirada do Termo ${e.termoPaa?.numeroTermo} por ${autor}`]
      if (motivo) partes.push(`motivo: ${motivo}`)
      const linha = partes.join(' — ')
      const observacoes = e.observacoes ? `${e.observacoes}\n${linha}` : linha

      const upd = await tx.entregaPaa.updateMany({
        where: { id: entregaId, termoPaaId: termoId, updatedAt: e.updatedAt },
        data: { status: 'ASSINADA', termoPaaId: null, observacoes },
      })
      if (upd.count === 0) {
        throw new HttpError(409, 'A entrega foi alterada simultaneamente. Recarregue e tente de novo.')
      }

      const totais = await recalcularTotaisTermo(tx, termoId)
      return {
        entregaId,
        status: 'ASSINADA' as const,
        termo: {
          id: termoId,
          valorTotal: Number(totais.valorTotal),
          quantidadeTotal: Number(totais.quantidadeTotal),
          pesoTotalKg: Number(totais.pesoTotalKg),
          vazio: totais.vazio,
        },
      }
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[DELETE /api/paa/termos/[id]/entregas/[entregaId]] erro:', error)
    return NextResponse.json({ error: 'Erro ao retirar entrega do Termo' }, { status: 500 })
  }
}
