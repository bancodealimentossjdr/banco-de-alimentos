// src/app/api/eventos/[id]/arrecadacao-extra/[registroId]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { renumerarShow, SHOWS_CONGELADOS, type TxClient } from '@/lib/renumerar-cupons'

export const dynamic = 'force-dynamic'

type ItemInput = {
  showDia: string
  alimentoId: string
  quantidade: number
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; registroId: string }> },
) {
  const { id: eventoId, registroId } = await params

  const result = await requireAuth()
  if (!('user' in result)) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (result.user.role !== 'dev') {
    return NextResponse.json({ error: 'Apenas dev pode editar.' }, { status: 403 })
  }

  const body: unknown = await req.json().catch(() => null)
  if (body === null || typeof body !== 'object') {
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
  if (localId !== null && localId !== undefined && typeof localId !== 'string') {
    return NextResponse.json({ error: 'Local inválido.' }, { status: 400 })
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Adicione ao menos um item.' }, { status: 400 })
  }

  const registro = await prisma.arrecadacaoExtra.findFirst({
    where: { id: registroId, eventoId },
    select: {
      id: true,
      doadorCpf: true,
      itens: { select: { showDia: true } },
    },
  })
  if (!registro) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  // ---- validação tipada dos itens ----
  const itensValidados: ItemInput[] = []
  for (const raw of itens as unknown[]) {
    if (raw === null || typeof raw !== 'object') {
      return NextResponse.json({ error: 'Item inválido.' }, { status: 400 })
    }
    const it = raw as { showDia?: unknown; alimentoId?: unknown; quantidade?: unknown }

    if (typeof it.showDia !== 'string' || it.showDia.trim().length === 0) {
      return NextResponse.json({ error: 'Show inválido.' }, { status: 400 })
    }
    if (typeof it.alimentoId !== 'string' || it.alimentoId.length === 0) {
      return NextResponse.json({ error: 'Alimento inválido.' }, { status: 400 })
    }
    if (!Number.isInteger(it.quantidade) || (it.quantidade as number) < 1) {
      return NextResponse.json({ error: 'Quantidade inválida.' }, { status: 400 })
    }

    itensValidados.push({
      showDia: it.showDia.trim(),
      alimentoId: it.alimentoId,
      quantidade: it.quantidade as number,
    })
  }

  const alims = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: itensValidados.map((i: ItemInput) => i.alimentoId) } },
    select: { id: true },
  })
  const alimsSet = new Set<string>(alims.map((a: { id: string }) => a.id))
  if (itensValidados.some((i: ItemInput) => !alimsSet.has(i.alimentoId))) {
    return NextResponse.json({ error: 'Alimento não pertence ao evento' }, { status: 400 })
  }

  if (typeof localId === 'string' && localId.length > 0) {
    const local = await prisma.localColeta.findFirst({
      where: { id: localId, eventoId },
      select: { id: true },
    })
    if (!local) {
      return NextResponse.json({ error: 'Local não pertence ao evento' }, { status: 400 })
    }
  }

  // ---- shows afetados (antes + depois) ----
  const showsAfetados = new Set<string>([
    ...registro.itens.map((i: { showDia: string }) => i.showDia),
    ...itensValidados.map((i: ItemInput) => i.showDia),
  ])

  const congelado: string | undefined = Array.from(showsAfetados).find((s: string) =>
    SHOWS_CONGELADOS.has(s),
  )
  if (congelado) {
    return NextResponse.json(
      {
        error: `Os cupons do show "${congelado}" já foram divulgados. Cancele e crie um novo registro em vez de editar quantidades.`,
      },
      { status: 409 },
    )
  }

  // ---- CPF ----
  const cpfDigitos: string =
    typeof doadorCpf === 'string' ? doadorCpf.replace(/\D/g, '') : ''
  let doadorCpfFinal: string | null = registro.doadorCpf

  if (cpfDigitos.length === 11) {
    doadorCpfFinal = cpfDigitos
  } else if (typeof doadorCpf === 'string' && doadorCpf.trim() === '__LIMPAR__') {
    doadorCpfFinal = null
  } else if (cpfDigitos.length > 0 && cpfDigitos.length !== 11) {
    return NextResponse.json({ error: 'CPF deve ter 11 dígitos' }, { status: 400 })
  }

  try {
    await prisma.$transaction(async (tx: TxClient) => {
      await tx.arrecadacaoExtra.update({
        where: { id: registroId },
        data: {
          doadorNome: doadorNome.trim(),
          doadorCpf: doadorCpfFinal,
          localId: typeof localId === 'string' && localId.length > 0 ? localId : null,
        },
      })

      await tx.arrecadacaoItem.deleteMany({ where: { arrecadacaoId: registroId } })

      /**
       * ✅ ONDA 21.7 — números provisórios (0) + renumeração derivada.
       * A posição na sequência vem do createdAt do ArrecadacaoExtra,
       * então editar não desloca o doador nem abre buracos.
       */
      await tx.arrecadacaoItem.createMany({
        data: itensValidados.map((it: ItemInput) => ({
          arrecadacaoId: registroId,
          showDia: it.showDia,
          alimentoId: it.alimentoId,
          quantidade: it.quantidade,
          numeroInicio: 0,
          numeroFim: 0,
        })),
      })

      for (const showDia of Array.from(showsAfetados)) {
        await renumerarShow(tx, eventoId, showDia)
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
  if (!('user' in result)) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (result.user.role !== 'dev') {
    return NextResponse.json({ error: 'Apenas dev pode excluir.' }, { status: 403 })
  }

  const registro = await prisma.arrecadacaoExtra.findFirst({
    where: { id: registroId, eventoId },
    select: { id: true, itens: { select: { showDia: true } } },
  })
  if (!registro) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  const showsAfetados = new Set<string>(
    registro.itens.map((i: { showDia: string }) => i.showDia),
  )

  const congelado: string | undefined = Array.from(showsAfetados).find((s: string) =>
    SHOWS_CONGELADOS.has(s),
  )
  if (congelado) {
    return NextResponse.json(
      {
        error: `Os cupons do show "${congelado}" já foram divulgados. A exclusão abriria buracos na numeração pública.`,
      },
      { status: 409 },
    )
  }

  try {
    await prisma.$transaction(async (tx: TxClient) => {
      await tx.arrecadacaoExtra.delete({ where: { id: registroId } })
      for (const showDia of Array.from(showsAfetados)) {
        await renumerarShow(tx, eventoId, showDia)
      }
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Erro DELETE arrecadacao-extra:', e)
    return NextResponse.json({ error: 'Erro ao excluir.' }, { status: 500 })
  }
}
