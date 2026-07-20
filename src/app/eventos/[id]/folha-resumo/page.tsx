import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { canView } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import FolhaResumoClient from './FolhaResumoClient'

export default async function FolhaResumoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const role = session.user.role
  if (!canView(role, 'eventos')) redirect('/dashboard')

  const { id } = await params

  const evento = await prisma.evento.findUnique({
    where: { id },
    select: { id: true, nome: true, status: true },
  })

  if (!evento) redirect('/eventos')

  return (
    <FolhaResumoClient
      eventoId={evento.id}
      eventoNome={evento.nome}
      eventoStatus={evento.status}
      role={role}
    />
  )
}
