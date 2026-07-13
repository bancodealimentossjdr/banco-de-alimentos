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
  if ('user' in result === false) {
    redirect('/login')
  }
  const userId = result.user.id
  const role = result.user.role

  const { id: eventoId } = await params

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      nome: true,
      status: true,
      alimentos: {
        select: {
          id: true,
          ordem: true,
          product: { select: { name: true, unit: true } },
        },
        orderBy: { ordem: 'asc' },
      },
      locais: {
        select: { id: true, nome: true },
        orderBy: { createdAt: 'asc' },
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

  const alimentos = evento.alimentos.map((a) => ({
    id: a.id,
    nome: a.product.name,
  }))

  const locais = evento.locais.map((l) => ({
    id: l.id,
    nome: l.nome,
  }))

  const registrosDb = await prisma.arrecadacaoExtra.findMany({
    where: { eventoId },
    orderBy: { numeroInicio: 'desc' },
    select: {
      id: true,
      doadorNome: true,
      quantidade: true,
      numeroInicio: true,
      numeroFim: true,
      alimento: { select: { product: { select: { name: true } } } },
      local: { select: { nome: true } },
    },
  })

  const registrosIniciais = registrosDb.map((r) => ({
    id: r.id,
    doadorNome: r.doadorNome,
    quantidade: r.quantidade,
    numeroInicio: r.numeroInicio,
    numeroFim: r.numeroFim,
    alimentoNome: r.alimento?.product?.name ?? '—',
    localNome: r.local?.nome ?? '—',
  }))

  const totalInicial = registrosIniciais.reduce((s, r) => s + r.quantidade, 0)

  return (
    <ArrecadacaoExtraClient
      eventoId={evento.id}
      eventoNome={evento.nome}
      eventoAtivo={evento.status === 'ATIVO'}
      alimentos={alimentos}
      locais={locais}
      registrosIniciais={registrosIniciais}
      totalInicial={totalInicial}
    />
  )
}
