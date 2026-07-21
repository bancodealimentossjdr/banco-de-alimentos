// src/app/api/eventos/[id]/arrecadacao-extra/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

type ItemValido = {
  showDia: string
  alimentoId: string
  quantidade: number
}

async function autorizar(eventoId: string) {
  const result = await requireAuth()
  if (('user' in result) === false) {
    return { ok: false as const, status: 401, error: 'Não autenticado' }
  }
  const userId = result.user.id
  const role = result.user.role

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) return { ok: false as const, status: 404, error: 'Evento não localizado' }
  if (evento.status !== 'ATIVO') {
    return { ok: false as const, status: 403, error: 'Evento não está ativo' }
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
    return { ok: false as const, status: 403, error: 'Permissão negada' }
  }

  return { ok: true as const, userId, role, podeEditar: role === 'dev' }
}

// ==========================================
// GET — listas + registros + shows reais
// ==========================================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventoId } = await params
  const auth = await autorizar(eventoId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const eventoAlimentos = await prisma.eventoAlimento.findMany({
    where: { eventoId },
    select: { id: true, product: { select: { name: true } } },
    orderBy: { ordem: 'asc' },
  })
  const alimentos = eventoAlimentos.map((ea) => ({
    id: ea.id,
    nome: ea.product.name,
  }))

  const locaisRaw = await prisma.localColeta.findMany({
    where: { eventoId },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })
  const locais = locaisRaw.map((l) => ({ id: l.id, nome: l.nome }))

  const registrosRaw = await prisma.arrecadacaoExtra.findMany({
    where: { eventoId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      doadorNome: true,
      doadorCpf: true,
      local: { select: { nome: true } },
      itens: {
        orderBy: { numeroInicio: 'asc' },
        select: {
          id: true,
          showDia: true,
          quantidade: true,
          numeroInicio: true,
          numeroFim: true,
          alimento: { select: { product: { select: { name: true } } } },
        },
      },
    },
  })

  const registros = registrosRaw.map((r) => ({
    id: r.id,
    doadorNome: r.doadorNome,
    doadorCpf: r.doadorCpf,
    localNome: r.local?.nome ?? null,
    itens: r.itens.map((it) => ({
      id: it.id,
      showDia: it.showDia,
      alimentoNome: it.alimento.product.name,
      quantidade: it.quantidade,
      numeroInicio: it.numeroInicio,
      numeroFim: it.numeroFim,
    })),
  }))

  const totaisPorShow: Record<string, number> = {}
  for (const r of registrosRaw) {
    for (const it of r.itens) {
      totaisPorShow[it.showDia] = (totaisPorShow[it.showDia] ?? 0) + it.quantidade
    }
  }
  const showsDistintos = Object.keys(totaisPorShow).sort()

  return NextResponse.json({
    alimentos,
    locais,
    registros,
    totaisPorShow,
    showsDistintos,
    podeEditar: auth.podeEditar,
  })
}

// ==========================================
// POST — criar registro + itens (numeração ATÔMICA por show)
// ==========================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventoId } = await params
  const auth = await autorizar(eventoId)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  const { doadorNome, doadorCpf, localId, itens } = body
  const doadorNomeTrim = (doadorNome ?? '').trim()
  const doadorCpfTrim = (doadorCpf ?? '').trim() || null
  const localIdValid = localId || null

  if (doadorNomeTrim.length < 2) {
    return NextResponse.json({ error: 'Nome do doador inválido' }, { status: 400 })
  }
  if (!Array.isArray(itens)) {
    return NextResponse.json({ error: 'Itens inválidos' }, { status: 400 })
  }

  const itensValidos: ItemValido[] = []
  for (const it of itens) {
    const showDia = typeof it.showDia === 'string' ? it.showDia.trim() : ''
    const alimentoId = typeof it.alimentoId === 'string' ? it.alimentoId.trim() : ''
    const quantidadeNum = Number(it.quantidade)
    if (
      showDia.length > 0 &&
      alimentoId.length > 0 &&
      Number.isInteger(quantidadeNum) &&
      quantidadeNum > 0
    ) {
      itensValidos.push({ showDia, alimentoId, quantidade: quantidadeNum })
    }
  }
  if (itensValidos.length === 0) {
    return NextResponse.json({ error: 'Nenhum item válido' }, { status: 400 })
  }

  const alims = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: itensValidos.map((i) => i.alimentoId) } },
    select: { id: true },
  })
  const alimsSet = new Set(alims.map((a) => a.id))
  if (itensValidos.some((i) => !alimsSet.has(i.alimentoId))) {
    return NextResponse.json({ error: 'Alimento não pertence ao evento' }, { status: 400 })
  }

  try {
    const criado = await prisma.$transaction(async (tx) => {
      // 🔑 numeração ATÔMICA por (eventoId, showDia)
      // Agrupa quantidade por show p/ 1 incremento por show
      const qtdPorShow = new Map<string, number>()
      for (const it of itensValidos) {
        qtdPorShow.set(it.showDia, (qtdPorShow.get(it.showDia) ?? 0) + it.quantidade)
      }

      // baseInicio[showDia] = primeiro número livre daquele show
      const baseInicio = new Map<string, number>()
      for (const [showDia, qtd] of qtdPorShow) {
        // upsert + increment atômico: dois pontos simultâneos NUNCA colidem
        const contador = await tx.showContador.upsert({
          where: { eventoId_showDia: { eventoId, showDia } },
          create: { eventoId, showDia, ultimoNumero: qtd },
          update: { ultimoNumero: { increment: qtd } },
          select: { ultimoNumero: true },
        })
        // pós-incremento → faixa reservada é [ultimoNumero-qtd+1 .. ultimoNumero]
        baseInicio.set(showDia, contador.ultimoNumero - qtd + 1)
      }

      // distribui números dentro da faixa reservada de cada show
      const cursorPorShow = new Map(baseInicio)
      const itensComFaixa = itensValidos.map((it) => {
        const inicio = cursorPorShow.get(it.showDia)!
        const fim = inicio + it.quantidade - 1
        cursorPorShow.set(it.showDia, fim + 1)
        return {
          showDia: it.showDia,
          alimentoId: it.alimentoId,
          quantidade: it.quantidade,
          numeroInicio: inicio,
          numeroFim: fim,
        }
      })

      return tx.arrecadacaoExtra.create({
        data: {
          eventoId,
          doadorNome: doadorNomeTrim,
          doadorCpf: doadorCpfTrim,
          localId: localIdValid,
          operadorId: auth.userId,
          itens: { create: itensComFaixa },
        },
        select: {
          id: true,
          itens: { select: { showDia: true, numeroInicio: true, numeroFim: true } },
        },
      })
    })

    return NextResponse.json(
      { ok: true, id: criado.id, itens: criado.itens },
      { status: 201 }
    )
  } catch (e) {
    console.error('Erro POST arrecadacao-extra:', e)
    return NextResponse.json({ error: 'Erro ao registrar' }, { status: 500 })
  }
}
