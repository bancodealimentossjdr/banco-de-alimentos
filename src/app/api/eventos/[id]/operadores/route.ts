import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/auth-helpers'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrDev()
  if (auth instanceof NextResponse) return auth

  const { id: eventoId } = await params

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const userId = body.userId?.trim()
  if (!userId) {
    return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
  }

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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, email: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  if (user.role !== 'visualizador') {
    return NextResponse.json(
      {
        error:
          'Apenas usuários visualizadores precisam de vínculo. Admin e operador já registram em qualquer evento.',
      },
      { status: 400 },
    )
  }

  const operador = await prisma.eventoOperador.upsert({
    where: { eventoId_userId: { eventoId, userId } },
    update: { ativo: true },
    create: { eventoId, userId, ativo: true },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  return NextResponse.json(
    {
      id: operador.id,
      ativo: operador.ativo,
      userId: operador.user.id,
      nome: operador.user.name,
      email: operador.user.email,
      role: operador.user.role,
    },
    { status: 201 },
  )
}
