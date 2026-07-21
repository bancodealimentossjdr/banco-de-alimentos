// src/app/api/eventos/[id]/arrecadacao-extra/[registroId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'

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
    return NextResponse.json({ error: 'Nome do doador é obrigatório.' }, { status: 400 })
  }
  if (localId !== null && typeof localId !== 'string') {
    return NextResponse.json({ error: 'Local inválido.' }, { status: 400 })
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos um item.' }, { status: 400 })
  }

  const registro = await prisma.arrecadacaoExtra.findFirst({
    where: { id: registroId, eventoId },
    select: { id: true },
  })
  if (!registro) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  const itensValidados: { showDia: string; alimentoId: string; quantidade: number }[] = []
  for (const it of itens) {
    if (typeof it?.showDia !== 'string' || it.showDia.trim().length === 0) {
      return NextResponse.json({ error: 'Show inválido.' }, { status: 400 })
    }
    if (typeof it?.alimentoId !== 'string') {
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.arrecadacaoExtra.update({
        where: { id: registroId },
        data: {
          doadorNome: doadorNome.trim(),
          doadorCpf:
            typeof doadorCpf === 'string' && doadorCpf.trim().length > 0
              ? doadorCpf.trim()
              : null,
          localId: localId ?? null,
        },
      })

      // apaga itens antigos e regenera com faixas ATÔMICAS por show
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
      for (const it of itensValidados) {
        const inicio = cursorPorShow.get(it.showDia)!
        const fim = inicio + it.quantidade - 1
        cursorPorShow.set(it.showDia, fim + 1)
        await tx.arrecadacaoItem.create({
          data: {
            arrecadacaoId: registroId,
            showDia: it.showDia,
            alimentoId: it.alimentoId,
            quantidade: it.quantidade,
            numeroInicio: inicio,
            numeroFim: fim,
          },
        })
      }
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

  await prisma.arrecadacaoExtra.delete({ where: { id: registroId } })
  return NextResponse.json({ ok: true })
}
