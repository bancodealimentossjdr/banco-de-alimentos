import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'
import ArrecadacaoExtraClient from './Client'

export default async function ArrecadacaoExtraPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const result = await requireAuth()
  if ('user' in result === false) redirect('/login')

  const userId = result.user.id
  const role = result.user.role
  const { id: eventoId } = await params

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, nome: true, status: true },
  })

  if (!evento) notFound()
  if (evento.status !== 'ATIVO') redirect(`/eventos/${eventoId}`)

  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    redirect(`/eventos/${eventoId}`)
  }

  return (
    <ArrecadacaoExtraClient
      eventoId={evento.id}
      eventoNome={evento.nome}
      subtitulo="Arrecadação de alimentos · cupons por show"
    />
  )
}
