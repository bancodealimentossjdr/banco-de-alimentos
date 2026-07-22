import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

/**
 * 🆕 ONDA 17.4 — Registro EM LOTE de recebimentos num local do evento.
 * 🔄 17.6-h (Decisão #18) — Gate de registro por evento.
 * 🆕 CPF — doação normal agora grava CPF do doador (opcional) em cada recebimento.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1️⃣ Autenticação
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const operadorId = result.user.id
  const role = result.user.role

  const { id: eventoId } = await params

  // 2️⃣ Parse do body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { localId, itens, doadorCpf } = (body ?? {}) as {
    localId?: string
    doadorCpf?: string | null
    itens?: { alimentoId?: string; quantidade?: number }[]
  }

  if (!localId || typeof localId !== 'string') {
    return NextResponse.json({ error: 'localId é obrigatório' }, { status: 400 })
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos um item' }, { status: 400 })
  }

  // 🆕 CPF — opcional, guarda só dígitos (aceita só se tiver 11 dígitos)
  const cpfLimpo =
    typeof doadorCpf === 'string' && doadorCpf.replace(/\D/g, '').length === 11
      ? doadorCpf.replace(/\D/g, '')
      : null

  // Normaliza + filtra: só quantidades válidas e > 0
  const itensLimpos = itens
    .map((i) => ({
      alimentoId: typeof i.alimentoId === 'string' ? i.alimentoId : '',
      quantidade: Number(i.quantidade),
    }))
    .filter(
      (i) =>
        i.alimentoId !== '' &&
        Number.isFinite(i.quantidade) &&
        i.quantidade > 0,
    )

  if (itensLimpos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma quantidade válida (> 0) para registrar' },
      { status: 400 },
    )
  }

  // 3️⃣ Evento existe e está ATIVO
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  if (evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Só é possível registrar recebimentos em eventos ATIVOS' },
      { status: 409 },
    )
  }

  // 3️⃣.5 Gate de registro por evento
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId: operadorId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para registrar doações neste evento' },
      { status: 403 },
    )
  }

  // 4️⃣ Local pertence ao evento
  const local = await prisma.localColeta.findFirst({
    where: { id: localId, eventoId },
    select: { id: true },
  })

  if (!local) {
    return NextResponse.json(
      { error: 'Local não pertence a este evento' },
      { status: 404 },
    )
  }

  // 5️⃣ Alimentos pertencem ao evento + snapshot da unidade
  const alimentoIds = itensLimpos.map((i) => i.alimentoId)

  const alimentos = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: alimentoIds } },
    select: { id: true, product: { select: { unit: true } } },
  })

  const unidadePorAlimento = new Map(
    alimentos.map((a) => [a.id, a.product.unit]),
  )

  const invalido = itensLimpos.find((i) => !unidadePorAlimento.has(i.alimentoId))
  if (invalido) {
    return NextResponse.json(
      { error: 'Um ou mais alimentos não pertencem a este evento' },
      { status: 400 },
    )
  }

  // 6️⃣ Persiste tudo numa transação (atomicidade)
  const criados = await prisma.$transaction(
    itensLimpos.map((i) =>
      prisma.recebimento.create({
        data: {
          eventoId,
          localId,
          alimentoId: i.alimentoId,
          quantidade: i.quantidade,
          unidade: unidadePorAlimento.get(i.alimentoId)!, // snapshot
          operadorId,
          doadorCpf: cpfLimpo, // 🆕 CPF
        },
        select: { id: true, alimentoId: true, quantidade: true, unidade: true },
      }),
    ),
  )

  return NextResponse.json(
    { ok: true, registrados: criados.length, recebimentos: criados },
    { status: 201 },
  )
}

/**
 * 🆕 GET — lista paginada/filtrável de recebimentos do evento (gestão fina).
 * Filtros: localId, alimentoId, cpf (busca por dígitos). Paginação: page/perPage.
 * Mesmo gate do POST (evento ATIVO + role/vínculo).
 *
 * ✅ Relações confirmadas pelo schema (model Recebimento):
 *   - Local    → relação `local` (model LocalColeta) → nome
 *   - Alimento → relação `alimento` (model EventoAlimento) → product.name
 *   - Operador → relação `operador` (via operadorId) → name
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const userId = result.user.id
  const role = result.user.role

  const { id: eventoId } = await params

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }
  if (evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Só é possível gerir recebimentos em eventos ATIVOS' },
      { status: 409 },
    )
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
    return NextResponse.json(
      { error: 'Você não tem permissão para gerir recebimentos neste evento' },
      { status: 403 },
    )
  }

  // Query params
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage')) || 50))
  const localId = url.searchParams.get('localId') || undefined
  const alimentoId = url.searchParams.get('alimentoId') || undefined
  const cpfRaw = url.searchParams.get('cpf')?.replace(/\D/g, '') || undefined

  const where = {
    eventoId,
    ...(localId ? { localId } : {}),
    ...(alimentoId ? { alimentoId } : {}),
    ...(cpfRaw ? { doadorCpf: { contains: cpfRaw } } : {}),
  }

  const [total, registros] = await prisma.$transaction([
    prisma.recebimento.count({ where }),
    prisma.recebimento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        quantidade: true,
        unidade: true,
        doadorCpf: true,
        createdAt: true,
        localId: true,
        alimentoId: true,
        local: { select: { nome: true } },
        alimento: { select: { product: { select: { name: true } } } },
        operador: { select: { name: true } },
      },
    }),
  ])

  const dados = registros.map((r) => ({
    id: r.id,
    quantidade: r.quantidade,
    unidade: r.unidade,
    doadorCpf: r.doadorCpf,
    createdAt: r.createdAt,
    localId: r.localId,
    alimentoId: r.alimentoId,
    localNome: r.local?.nome ?? '—',
    alimentoNome: r.alimento?.product?.name ?? '—',
    operadorNome: r.operador?.name ?? '—',
  }))

  return NextResponse.json({ registros: dados, total, page, perPage })
}
