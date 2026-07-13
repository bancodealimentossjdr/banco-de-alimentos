import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventoId } = await params

  // 1️⃣ Sessão
  const result = await requireAuth()
  if ('user' in result === false) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const userId = result.user.id
  const role = result.user.role

  // 2️⃣ Body
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  }

  const { doadorNome, doadorCpf, alimentoId, localId, quantidade } = body

  // 3️⃣ Validação (dados da pessoa SEMPRE obrigatórios)
  if (typeof doadorNome !== 'string' || doadorNome.trim().length < 2) {
    return NextResponse.json(
      { error: 'Nome do doador é obrigatório.' },
      { status: 400 },
    )
  }
  if (!alimentoId || typeof alimentoId !== 'string') {
    return NextResponse.json({ error: 'Alimento inválido.' }, { status: 400 })
  }
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    return NextResponse.json(
      { error: 'Quantidade deve ser um número inteiro maior que zero (cada unidade = 1 cupom).' },
      { status: 400 },
    )
  }

  // 4️⃣ Evento existe + ATIVO
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }
  if (evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Evento não está ativo.' },
      { status: 409 },
    )
  }

  // 5️⃣ Gate role + vínculo (idêntico ao fluxo de campo)
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }
  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json({ error: 'Sem permissão neste evento.' }, { status: 403 })
  }

  // 6️⃣ Alimento pertence ao evento?
  const alimento = await prisma.eventoAlimento.findFirst({
    where: { id: alimentoId, eventoId },
    select: { id: true },
  })
  if (!alimento) {
    return NextResponse.json(
      { error: 'Alimento não pertence a este evento.' },
      { status: 400 },
    )
  }

  // 6️⃣.5 Local pertence ao evento? (opcional, mas se enviado, valida)
  if (localId != null) {
    if (typeof localId !== 'string') {
      return NextResponse.json({ error: 'Local inválido.' }, { status: 400 })
    }
    const local = await prisma.localColeta.findFirst({
      where: { id: localId, eventoId },
      select: { id: true },
    })
    if (!local) {
      return NextResponse.json(
        { error: 'Local não pertence a este evento.' },
        { status: 400 },
      )
    }
  }

  // 7️⃣ Numeração sequencial GLOBAL por evento (transação anti-colisão)
  try {
    const registro = await prisma.$transaction(async (tx) => {
      const ultimo = await tx.arrecadacaoExtra.findFirst({
        where: { eventoId },
        orderBy: { numeroFim: 'desc' },
        select: { numeroFim: true },
      })

      const numeroInicio = (ultimo?.numeroFim ?? 0) + 1
      const numeroFim = numeroInicio + quantidade - 1

      return tx.arrecadacaoExtra.create({
        data: {
          eventoId,
          doadorNome: doadorNome.trim(),
          doadorCpf: doadorCpf?.trim() || null,
          alimentoId,
          localId: localId ?? null,
          quantidade,
          numeroInicio,
          numeroFim,
          operadorId: userId,
        },
        select: {
          id: true,
          numeroInicio: true,
          numeroFim: true,
          doadorNome: true,
          quantidade: true,
        },
      })
    })

    return NextResponse.json(
      {
        ok: true,
        registro,
        cupons: `${registro.numeroInicio}–${registro.numeroFim}`,
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Erro ao registrar. Tente novamente.' },
      { status: 500 },
    )
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventoId } = await params

  const result = await requireAuth()
  if ('user' in result === false) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const userId = result.user.id
  const role = result.user.role

  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }
  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json({ error: 'Sem permissão neste evento.' }, { status: 403 })
  }

  const [alimentosRaw, locaisRaw, registrosRaw] = await Promise.all([
    prisma.eventoAlimento.findMany({
      where: { eventoId },
      select: {
        id: true,
        product: { select: { name: true } },
      },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.localColeta.findMany({
      where: { eventoId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
    prisma.arrecadacaoExtra.findMany({
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
    }),
  ])

  const alimentos = alimentosRaw.map((a) => ({
    id: a.id,
    nome: a.product.name,
  }))

  const locais = locaisRaw.map((l) => ({
    id: l.id,
    nome: l.nome,
  }))

  const registros = registrosRaw.map((r) => ({
    id: r.id,
    doadorNome: r.doadorNome,
    quantidade: r.quantidade,
    numeroInicio: r.numeroInicio,
    numeroFim: r.numeroFim,
    alimentoNome: r.alimento.product.name,
    localNome: r.local?.nome ?? null,
  }))

  const totalCupons = registros.reduce((acc, r) => acc + r.quantidade, 0)

  return NextResponse.json({ alimentos, locais, registros, totalCupons })
}
