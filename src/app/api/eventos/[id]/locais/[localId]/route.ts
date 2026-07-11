import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

/**
 * 🆕 ONDA 17.8-f — Remove um LocalColeta do evento.
 *
 * Espelha o padrão de alimentos/[idAlimento]/route.ts.
 *
 * Defesa em profundidade:
 *   1. requireAdmin() → só admin (Decisão #22)
 *   2. evento existe
 *   3. evento NÃO pode estar ENCERRADO (cadeado — Decisão #14)
 *   4. local precisa pertencer AO evento
 *   5. bloqueia se houver Recebimento vinculado → 409 amigável
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; localId: string }> },
) {
  // 1️⃣ Permissão
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  const { id: eventoId, localId } = await params

  // 2️⃣ Evento existe
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 3️⃣ Evento não pode estar ENCERRADO
  if (evento.status === 'ENCERRADO') {
    return NextResponse.json(
      { error: 'Evento encerrado não pode ser alterado' },
      { status: 409 },
    )
  }

  // 4️⃣ Local pertence ao evento + verifica recebimentos
  const local = await prisma.localColeta.findFirst({
    where: { id: localId, eventoId },
    select: {
      id: true,
      nome: true,
      _count: { select: { recebimentos: true } },
    },
  })

  if (!local) {
    return NextResponse.json({ error: 'Local não pertence a este evento' }, { status: 404 })
  }

  // 5️⃣ Bloqueio por recebimentos
  if (local._count.recebimentos > 0) {
    return NextResponse.json(
      {
        error: `Não é possível remover "${local.nome}": já existem ${local._count.recebimentos} recebimento(s) registrado(s) neste local.`,
      },
      { status: 409 },
    )
  }

  // 6️⃣ Remove local
  await prisma.localColeta.delete({ where: { id: localId } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
