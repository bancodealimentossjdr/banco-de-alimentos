import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'
import CampoCliente from './CampoCliente'

export default async function CampoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const result = await requireAuth()
  if ('user' in result === false) {
    redirect('/login')
  }
  const userId = result.user.id
  const role = result.user.role

  const isDev = role === 'dev'

  const { id: eventoId } = await params

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      nome: true,
      status: true,
      locais: {
        select: { id: true, nome: true, endereco: true },
        orderBy: { nome: 'asc' },
      },
      alimentos: {
        select: {
          id: true,
          ordem: true,
          product: { select: { name: true, unit: true } },
        },
        orderBy: { ordem: 'asc' },
      },
    },
  })

  if (!evento) notFound()

  if (evento.status !== 'ATIVO') {
    redirect(`/eventos/${eventoId}`)
  }

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

  const locais = evento.locais.map((l) => ({
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
  }))

  const alimentos = evento.alimentos.map((a) => ({
    id: a.id,
    nome: a.product.name,
    unidade: a.product.unit,
  }))

  return (
    <CampoCliente
      eventoId={evento.id}
      eventoNome={evento.nome}
      locais={locais}
      alimentos={alimentos}
      isDev={isDev}
    />
  )
}
