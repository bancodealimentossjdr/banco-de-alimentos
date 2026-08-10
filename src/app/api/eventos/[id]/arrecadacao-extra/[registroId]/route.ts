// src/app/api/eventos/[id]/arrecadacao-extra/[registroId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; registroId: string }> },
) {
  const { id: eventoId, registroId } = await params

  const result = await requireAuth()
  if ('user' in result === false) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (result.user.role !== 'dev') {
    return NextResponse.json({ error: 'Apenas dev pode editar.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { doadorNome, doadorCpf, localId, itens } = body as {
    doadorNome?: unknown
    doadorCpf?: unknown
    localId?: unknown
    itens?: unknown
  }

  if (typeof doadorNome !== 'string' || doadorNome.trim().length < 2) {
    return NextResponse.json(
      { error: 'Nome do doador é obrigatório.' },
      { status: 400 },
    )
  }
  if (localId !== null && localId !== undefined && typeof localId !== 'string') {
    return NextResponse.json({ error: 'Local inválido.' }, { status: 400 })
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos um item.' }, { status: 400 })
  }

  const registro = await prisma.arrecadacaoExtra.findFirst({
    where: { id: registroId, eventoId },
    select: { id: true, doadorCpf: true },
  })
  if (!registro) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  const itensValidados: { showDia: string; alimentoId: string; quantidade: number }[] =
    []
  for (const it of itens) {
    if (typeof it?.showDia !== 'string' || it.showDia.trim().length === 0) {
      return NextResponse.json({ error: 'Show inválido.' }, { status: 400 })
    }
    if (typeof it?.alimentoId !== 'string' || it.alimentoId.length === 0) {
      return NextResponse.json({ error: 'Alimento inválido.' }, { status: 400 })
    }
    if (!Number.isInteger(it?.quantidade) || it.quantidade < 1) {
      return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 })
    }
    itensValidados.push({
      showDia: it.showDia.trim(),
      alimentoId: it.alimentoId,
      quantidade: it.quantidade,
    })
  }

  // ✅ alimentos precisam pertencer ao evento (faltava no PUT original)
  const alims = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: itensValidados.map((i) => i.alimentoId) } },
    select: { id: true },
  })
  const alimsSet = new Set(alims.map((a) => a.id))
  if (itensValidados.some((i) => !alimsSet.has(i.alimentoId))) {
    return NextResponse.json(
      { error: 'Alimento não pertence ao evento' },
      { status: 400 },
    )
  }

  if (typeof localId === 'string' && localId.length > 0) {
    const local = await prisma.localColeta.findFirst({
      where: { id: localId, eventoId },
      select: { id: true },
    })
    if (!local) {
      return NextResponse.json(
        { error: 'Local não pertence ao evento' },
        { status: 400 },
      )
    }
  }

  /**
   * 🎭 CPF na edição:
   * o dev enxerga o CPF cru, então pode reenviá-lo. Mas se vier vazio,
   * PRESERVAMOS o valor existente em vez de apagar — evita perda silenciosa
   * de dado quando o formulário não repopula o campo.
   */
  const cpfDigitos =
    typeof doadorCpf === 'string' ? doadorCpf.replace(/\D/g, '') : ''
  let doadorCpfFinal: string | null = registro.doadorCpf
  if (cpfDigitos.length === 11) doadorCpfFinal = cpfDigitos
  else if (typeof doadorCpf === 'string' && doadorCpf.trim() === '__LIMPAR__')
    doadorCpfFinal = null
  else if (cpfDigitos.length > 0 && cpfDigitos.length !== 11) {
    return NextResponse.json({ error: 'CPF deve ter 11 dígitos' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.arrecadacaoExtra.update({
        where: { id: registroId },
        data: {
          doadorNome: doadorNome.trim(),
          doadorCpf: doadorCpfFinal,
          localId: (localId as string | null) ?? null,
        },
      })

      /**
       * ⚠️ DECISÃO CONSCIENTE (ONDA 21.6):
       * ao editar, as faixas antigas são DESCARTADAS e novas são emitidas
       * a partir do contador. Os números antigos NÃO são reciclados —
       * cupons já impressos/entregues nunca são reutilizados por outro doador.
       * Custo: buracos na sequência. Benefício: rastreabilidade e zero colisão.
       */
      await tx.arrecadacaoItem.deleteMany({ where: { arrecadacaoId: registroId } })

      const qtdPorShow = new Map<string, number>()
      for (const it of itensValidados) {
        qtdPorShow.set(it.showDia, (qtdPorShow.get(it.showDia) ?? 0) + it.quantidade)
      }

      const baseInicio = new Map<string, number>()
      for (const [showDia, qtd] of qtdPorShow) {
        const contador = await tx.showContador.upsert({
          where: { eventoId_showDia: { eventoId, showDia } },
          create: { eventoId, showDia, ultimoNumero: qtd },
          update: { ultimoNumero: { increment: qtd } },
          select: { ultimoNumero: true },
        })
        baseInicio.set(showDia, contador.ultimoNumero - qtd + 1)
      }

      const cursorPorShow = new Map(baseInicio)
      const novos = itensValidados.map((it) => {
        const inicio = cursorPorShow.get(it.showDia)!
        const fim = inicio + it.quantidade - 1
        cursorPorShow.set(it.showDia, fim + 1)
        return {
          arrecadacaoId: registroId,
          showDia: it.showDia,
          alimentoId: it.alimentoId,
          quantidade: it.quantidade,
          numeroInicio: inicio,
          numeroFim: fim,
        }
      })

      // ✅ createMany: 1 round-trip em vez de N (era create em loop)
      await tx.arrecadacaoItem.createMany({ data: novos })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro PUT arrecadacao-extra:', e)
    return NextResponse.json({ error: 'Erro ao editar.' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; registroId: string }> },
) {
  const { id: eventoId, registroId } = await params

  const result = await requireAuth()
  if ('user' in result === false) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (result.user.role !== 'dev') {
    return NextResponse.json({ error: 'Apenas dev pode excluir.' }, { status: 403 })
  }

  const registro = await prisma.arrecadacaoExtra.findFirst({
    where: { id: registroId, eventoId },
    select: { id: true },
  })
  if (!registro) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  // itens caem por onDelete: Cascade no schema
  await prisma.arrecadacaoExtra.delete({ where: { id: registroId } })
  return NextResponse.json({ ok: true })
}
