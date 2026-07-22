import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

/**
 * 🆕 Gestão fina de recebimentos individuais (PATCH/DELETE).
 * Mesmo gate do POST: evento ATIVO + role/vínculo.
 * OBS: recebimento NÃO gera movimentação de estoque (totais são agregados),
 * portanto DELETE/PATCH não precisa estornar nada.
 */

// helper: valida sessão + evento ATIVO + permissão + recebimento pertence ao evento
async function guard(eventoId: string, recebimentoId: string) {
  const result = await requireAuth()
  if (result instanceof NextResponse) return { error: result }

  const userId = result.user.id
  const role = result.user.role

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) {
    return { error: NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 }) }
  }
  if (evento.status !== 'ATIVO') {
    return {
      error: NextResponse.json(
        { error: 'Só é possível editar recebimentos em eventos ATIVOS' },
        { status: 409 },
      ),
    }
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
    return {
      error: NextResponse.json(
        { error: 'Você não tem permissão para editar recebimentos neste evento' },
        { status: 403 },
      ),
    }
  }

  const recebimento = await prisma.recebimento.findFirst({
    where: { id: recebimentoId, eventoId },
    select: { id: true },
  })
  if (!recebimento) {
    return {
      error: NextResponse.json({ error: 'Recebimento não pertence a este evento' }, { status: 404 }),
    }
  }

  return { userId, role }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; recebimentoId: string }> },
) {
  const { id: eventoId, recebimentoId } = await params

  const g = await guard(eventoId, recebimentoId)
  if ('error' in g) return g.error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { localId, alimentoId, quantidade, doadorCpf } = (body ?? {}) as {
    localId?: string
    alimentoId?: string
    quantidade?: number
    doadorCpf?: string | null
  }

  const data: {
    localId?: string
    alimentoId?: string
    quantidade?: number
    unidade?: string
    doadorCpf?: string | null
  } = {}

  // quantidade
  if (quantidade !== undefined) {
    const q = Number(quantidade)
    if (!Number.isFinite(q) || q <= 0) {
      return NextResponse.json({ error: 'Quantidade deve ser > 0' }, { status: 400 })
    }
    data.quantidade = q
  }

  // local (valida que pertence ao evento)
  if (localId !== undefined) {
    const local = await prisma.localColeta.findFirst({
      where: { id: localId, eventoId },
      select: { id: true },
    })
    if (!local) {
      return NextResponse.json({ error: 'Local não pertence a este evento' }, { status: 400 })
    }
    data.localId = localId
  }

  // alimento (valida + re-snapshota unidade)
  if (alimentoId !== undefined) {
    const alimento = await prisma.eventoAlimento.findFirst({
      where: { id: alimentoId, eventoId },
      select: { id: true, product: { select: { unit: true } } },
    })
    if (!alimento) {
      return NextResponse.json({ error: 'Alimento não pertence a este evento' }, { status: 400 })
    }
    data.alimentoId = alimentoId
    data.unidade = alimento.product.unit // 🔑 re-snapshot
  }

  // CPF (opcional; null limpa)
  if (doadorCpf !== undefined) {
    if (doadorCpf === null || doadorCpf === '') {
      data.doadorCpf = null
    } else {
      const limpo = String(doadorCpf).replace(/\D/g, '')
      data.doadorCpf = limpo.length === 11 ? limpo : null
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  const atualizado = await prisma.recebimento.update({
    where: { id: recebimentoId },
    data,
    select: {
      id: true,
      localId: true,
      alimentoId: true,
      quantidade: true,
      unidade: true,
      doadorCpf: true,
    },
  })

  return NextResponse.json({ ok: true, recebimento: atualizado })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; recebimentoId: string }> },
) {
  const { id: eventoId, recebimentoId } = await params

  const g = await guard(eventoId, recebimentoId)
  if ('error' in g) return g.error

  await prisma.recebimento.delete({ where: { id: recebimentoId } })

  return NextResponse.json({ ok: true })
}
