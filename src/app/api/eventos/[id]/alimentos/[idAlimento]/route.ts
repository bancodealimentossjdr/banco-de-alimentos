import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

/**
 * 🆕 ONDA 17.6-f — Remove um EventoAlimento do evento.
 *
 * Defesa em profundidade:
 *   1. requireAdmin() → só admin
 *   2. evento existe
 *   3. evento NÃO pode estar ENCERRADO (cadeado — Decisão #14)
 *   4. alimento precisa pertencer AO evento
 *   5. bloqueia se houver Recebimento vinculado → 409 FK amigável
 *      (Recebimento.alimento é Restrict — não há cascade por design)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; idAlimento: string }> },
) {
  // 1️⃣ Permissão
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  const { id: eventoId, idAlimento } = await params

  // 2️⃣ Evento existe
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })

  if (!evento) {
    return NextResponse.json(
      { error: 'Evento não encontrado' },
      { status: 404 },
    )
  }

  // 3️⃣ Evento não pode estar ENCERRADO
  if (evento.status === 'ENCERRADO') {
    return NextResponse.json(
      { error: 'Evento encerrado não pode ser alterado' },
      { status: 409 },
    )
  }

  // 4️⃣ Alimento pertence ao evento + conta recebimentos
  const alimento = await prisma.eventoAlimento.findFirst({
    where: { id: idAlimento, eventoId },
    select: {
      id: true,
      product: { select: { name: true } },
      _count: { select: { recebimentos: true } },
    },
  })

  if (!alimento) {
    return NextResponse.json(
      { error: 'Alimento não pertence a este evento' },
      { status: 404 },
    )
  }

  // 5️⃣ Bloqueia se houver recebimento (Restrict)
  if (alimento._count.recebimentos > 0) {
    return NextResponse.json(
      {
        error: `Não é possível remover "${alimento.product.name}": já existem ${alimento._count.recebimentos} recebimento(s) registrado(s) para este alimento.`,
      },
      { status: 409 },
    )
  }

  // 6️⃣ Remove
  await prisma.eventoAlimento.delete({ where: { id: idAlimento } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
