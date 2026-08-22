import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autorizarEvento } from '@/lib/eventos/vinculo'

/**
 * 🆕 ONDA 17.4 — Registro EM LOTE de recebimentos num local do evento.
 * 🔄 17.6-h (Decisão #18) — Gate de registro por evento.
 * 🆕 CPF — doação normal grava CPF do doador em cada recebimento.
 *    Aceita `cpf` ou `doadorCpf` no body (compat).
 * 🧹 ONDA 22 (22-d) — gate delegado a autorizarEvento().
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventoId } = await params

  // 1️⃣ auth + evento ATIVO + vínculo, num só lugar
  const ctx = await autorizarEvento(eventoId, { exigirAtivo: true })
  if (ctx instanceof NextResponse) return ctx
  const operadorId = ctx.userId

  // 2️⃣ Parse do body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { localId, itens, doadorCpf, cpf } = (body ?? {}) as {
    localId?: string
    doadorCpf?: string | null
    cpf?: string | null
    itens?: { alimentoId?: string; quantidade?: number }[]
  }

  if (!localId || typeof localId !== 'string') {
    return NextResponse.json({ error: 'localId é obrigatório' }, { status: 400 })
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json({ error: 'Envie ao menos um item' }, { status: 400 })
  }

  // 🆕 CPF — aceita `cpf` (novo front) ou `doadorCpf` (legado). Só dígitos, 11 exatos.
  const cpfBruto =
    typeof cpf === 'string' ? cpf : typeof doadorCpf === 'string' ? doadorCpf : ''
  const cpfDigitos = cpfBruto.replace(/\D/g, '')

  if (cpfDigitos.length !== 11) {
    return NextResponse.json(
      { error: 'CPF do doador é obrigatório (11 dígitos)' },
      { status: 400 },
    )
  }

  const cpfLimpo = cpfDigitos

  // Normaliza + filtra: só quantidades válidas e > 0
  const itensLimpos = itens
    .map((i) => ({
      alimentoId: typeof i.alimentoId === 'string' ? i.alimentoId : '',
      quantidade: Number(i.quantidade),
    }))
    .filter(
      (i) =>
        i.alimentoId !== '' && Number.isFinite(i.quantidade) && i.quantidade > 0,
    )

  if (itensLimpos.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma quantidade válida (> 0) para registrar' },
      { status: 400 },
    )
  }

  // 3️⃣ Local pertence ao evento
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

  // 4️⃣ Alimentos pertencem ao evento + snapshot da unidade
  const alimentoIds = itensLimpos.map((i) => i.alimentoId)

  const alimentos = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: alimentoIds } },
    select: { id: true, product: { select: { unit: true } } },
  })

  const unidadePorAlimento = new Map(alimentos.map((a) => [a.id, a.product.unit]))

  const invalido = itensLimpos.find((i) => !unidadePorAlimento.has(i.alimentoId))
  if (invalido) {
    return NextResponse.json(
      { error: 'Um ou mais alimentos não pertencem a este evento' },
      { status: 400 },
    )
  }

  // 5️⃣ Persiste tudo numa transação (atomicidade)
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
 *
 * ⚠️ Mantido `exigirAtivo: true` para não alterar comportamento nesta onda.
 *    Ver nota de "leitura de evento encerrado" no documento do projeto.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventoId } = await params

  const ctx = await autorizarEvento(eventoId, { exigirAtivo: true })
  if (ctx instanceof NextResponse) return ctx

  // Query params
  const url = new URL(req.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const perPage = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get('perPage')) || 50),
  )
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
