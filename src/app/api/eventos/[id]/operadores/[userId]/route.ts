import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/auth-helpers'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireAdminOrDev()
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
