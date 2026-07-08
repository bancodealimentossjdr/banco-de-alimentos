import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

/**
 * 🆕 ONDA 17.4 — Registro EM LOTE de recebimentos num local do evento.
 * 🔄 17.6-h (Decisão #18) — Gate de registro por evento:
 *   - admin / operador → registram em qualquer evento ATIVO
 *   - visualizador     → SÓ se tiver vínculo ATIVO (EventoOperador { ativo:true })
 *
 * Fluxo do voluntário no portão:
 *   - escolhe um Local do evento
 *   - ajusta quantidades por alimento (EventoAlimento)
 *   - SALVA → cria 1 Recebimento por alimento com quantidade > 0
 *
 * Defesa em profundidade:
 *   1. requireAuth() → precisa estar logado
 *   2. evento precisa existir e estar ATIVO
 *   3. 🆕 gate por role + vínculo (podeRegistrarNoEvento)
 *   4. local precisa pertencer AO evento
 *   5. cada alimento precisa pertencer AO evento
 *   6. unidade = snapshot de product.unit (frontend NÃO escolhe unidade)
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

  const { localId, itens } = (body ?? {}) as {
    localId?: string
    itens?: { alimentoId?: string; quantidade?: number }[]
  }

  if (!localId || typeof localId !== 'string') {
    return NextResponse.json(
      { error: 'localId é obrigatório' },
      { status: 400 },
    )
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return NextResponse.json(
      { error: 'Envie ao menos um item' },
      { status: 400 },
    )
  }

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
    return NextResponse.json(
      { error: 'Evento não encontrado' },
      { status: 404 },
    )
  }

  if (evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Só é possível registrar recebimentos em eventos ATIVOS' },
      { status: 409 },
    )
  }

  // 3️⃣.5 🆕 17.6-h (Decisão #18) — Gate de registro por evento.
  // admin/operador ignoram o vínculo; visualizador depende dele.
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

  // 5️⃣ Alimentos pertencem ao evento + snapshot da unidade (product.unit)
  const alimentoIds = itensLimpos.map((i) => i.alimentoId)

  const alimentos = await prisma.eventoAlimento.findMany({
    where: { eventoId, id: { in: alimentoIds } },
    select: { id: true, product: { select: { unit: true } } },
  })

  const unidadePorAlimento = new Map(
    alimentos.map((a) => [a.id, a.product.unit]),
  )

  // Algum item aponta pra alimento que não é deste evento?
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
