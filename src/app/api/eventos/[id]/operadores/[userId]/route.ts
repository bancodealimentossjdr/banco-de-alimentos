import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

/**
 * 🆕 17.6-g — Desvincular operador do evento (SOFT: ativo:false).
 *
 * Regras:
 * - Só admin.
 * - Evento não pode estar ENCERRADO.
 * - Soft delete (ativo:false) preserva histórico e casa com EventoOperador { ativo } (Decisão #8).
 *   Recebimentos já feitos NÃO são afetados (operadorId no Recebimento é independente).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const { id: eventoId, userId } = await params

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }
  if (evento.status === 'ENCERRADO') {
    return NextResponse.json(
      { error: 'Evento encerrado não aceita alteração de operadores' },
      { status: 409 },
    )
  }

  const vinculo = await prisma.eventoOperador.findUnique({
    where: { eventoId_userId: { eventoId, userId } },
    select: { id: true },
  })
  if (!vinculo) {
    return NextResponse.json({ error: 'Vínculo não encontrado' }, { status: 404 })
  }

  await prisma.eventoOperador.update({
    where: { eventoId_userId: { eventoId, userId } },
    data: { ativo: false },
  })

  return NextResponse.json({ ok: true, userId, ativo: false })
}
