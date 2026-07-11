import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'
import CampoCliente from './CampoCliente'

/**
 * 🆕 ONDA 17.4-c — Tela de campo (B-turbo).
 * 🐞 FIX 17.8 (Decisão #18) — antes usava requireRegisterRecebimento(), que só
 * olha o role e BARRAVA todo visualizador (mesmo vinculado). Agora replica a
 * MESMA lógica do backend (recebimentos/route.ts): requireAuth + vínculo ativo.
 *
 * Defesa em profundidade:
 *   1. sessão válida (requireAuth)
 *   2. evento existe e está ATIVO
 *   3. admin/operador → qualquer evento ATIVO
 *      visualizador   → SÓ se EventoOperador { ativo:true } neste evento
 */
export default async function CampoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // 1️⃣ Sessão
  const result = await requireAuth()
  if ('user' in result === false) {
    redirect('/login')
  }
  const userId = result.user.id
  const role = result.user.role

  const { id: eventoId } = await params

  // 2️⃣ Busca evento + locais + alimentos (com produto)
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

  // 3️⃣ Só evento ATIVO permite registro de campo
  if (evento.status !== 'ATIVO') {
    redirect(`/eventos/${eventoId}`)
  }

  // 4️⃣ 🆕 Gate por role + vínculo (idêntico ao backend recebimentos/route.ts)
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    // sem permissão neste evento → volta pro detalhe (não pro login/dashboard)
    redirect(`/eventos/${eventoId}`)
  }

  // 5️⃣ Achata pro formato que o cliente consome
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
    />
  )
}
