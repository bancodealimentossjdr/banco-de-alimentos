import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireAdmin } from '@/lib/auth-helpers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ──────────────────────────────────────────────
// GET — Detalhe de 1 evento (qualquer autenticado)
// ──────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('eventos')
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const evento = await prisma.evento.findUnique({
      where: { id },
      include: {
        locais: { orderBy: { createdAt: 'asc' } },
        // 🔄 17.4 — alimento agora traz o product
        alimentos: {
          orderBy: { ordem: 'asc' },
          include: { product: { select: { id: true, name: true, unit: true } } },
        },
        criadoPor: { select: { id: true, name: true } },
        encerradoPor: { select: { id: true, name: true } },
        _count: {
          select: { recebimentos: true, operadores: true, locais: true, alimentos: true },
        },
      },
    })

    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    return NextResponse.json(evento)
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    return NextResponse.json({ error: 'Erro ao buscar evento' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────
// PATCH — Transição de status (ativar / encerrar / reverter)
// Body: { action: 'ativar' | 'encerrar' | 'reverter' }
// 🆕 reverter: ATIVO → RASCUNHO (só admin, só sem recebimentos)
// ──────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const { action } = body as { action?: 'ativar' | 'encerrar' | 'reverter' }

    if (action !== 'ativar' && action !== 'encerrar' && action !== 'reverter') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const evento = await prisma.evento.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        _count: { select: { recebimentos: true } }, // 🆕 usado no reverter
      },
    })
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    // ── ATIVAR: só RASCUNHO → ATIVO ──
    if (action === 'ativar') {
      if (evento.status !== 'RASCUNHO') {
        return NextResponse.json(
          { error: 'Apenas eventos em rascunho podem ser ativados' },
          { status: 400 },
        )
      }

      const atualizado = await prisma.evento.update({
        where: { id },
        data: { status: 'ATIVO' },
      })
      return NextResponse.json(atualizado)
    }

    // ── 🆕 REVERTER: só ATIVO → RASCUNHO, e só sem recebimentos ──
    if (action === 'reverter') {
      if (evento.status !== 'ATIVO') {
        return NextResponse.json(
          { error: 'Apenas eventos ativos podem voltar a rascunho' },
          { status: 400 },
        )
      }
      if (evento._count.recebimentos > 0) {
        return NextResponse.json(
          {
            error:
              'Evento com doações registradas não pode voltar a rascunho',
          },
          { status: 400 },
        )
      }

      const atualizado = await prisma.evento.update({
        where: { id },
        data: { status: 'RASCUNHO' },
      })
      return NextResponse.json(atualizado)
    }

    // ── ENCERRAR: só ATIVO → ENCERRADO ──
    if (evento.status !== 'ATIVO') {
      return NextResponse.json(
        { error: 'Apenas eventos ativos podem ser encerrados' },
        { status: 400 },
      )
    }

    // Encerra + desativa operadores + auditoria, tudo numa transação
    const atualizado = await prisma.$transaction(async (tx) => {
      await tx.eventoOperador.updateMany({
        where: { eventoId: id, ativo: true },
        data: { ativo: false },
      })

      return tx.evento.update({
        where: { id },
        data: {
          status: 'ENCERRADO',
          encerradoPorId: authResult.user.id,
          encerradoEm: new Date(),
        },
      })
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error('Erro ao alterar status do evento:', error)
    return NextResponse.json({ error: 'Erro ao alterar status do evento' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────
// PUT — Editar evento + locais + alimentos (ADMIN)
// Regra: não remove local/alimento que já tem recebimento.
// 🔄 17.4 — alimentos: [{ productId, refugoKg }]
// 🆕 17.6 — grava refugoKg por alimento + obsRefugo geral do evento
// ──────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    // 🆕 17.6 — lê obsRefugo do body
    const { nome, descricao, dataInicio, dataFim, integraEstoque, locais, alimentos, obsRefugo } =
      body

    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Nome do evento é obrigatório' }, { status: 400 })
    }
    if (!dataInicio) {
      return NextResponse.json({ error: 'Data de início é obrigatória' }, { status: 400 })
    }
    if (dataFim && new Date(dataFim) < new Date(dataInicio)) {
      return NextResponse.json(
        { error: 'A data de término não pode ser anterior à de início' },
        { status: 400 },
      )
    }

    const evento = await prisma.evento.findUnique({
      where: { id },
      include: {
        locais: { include: { _count: { select: { recebimentos: true } } } },
        // 🔄 17.4 — traz product p/ mensagens de erro legíveis
        alimentos: {
          include: {
            _count: { select: { recebimentos: true } },
            product: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }
    if (evento.status === 'ENCERRADO') {
      return NextResponse.json(
        { error: 'Evento encerrado não pode ser editado' },
        { status: 400 },
      )
    }

    // ── Locais ──
    const locaisInput: { id?: string; nome?: string; endereco?: string | null }[] =
      Array.isArray(locais) ? locais : []
    const locaisValidos = locaisInput.filter((l) => l.nome && l.nome.trim())

    if (locaisValidos.length === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um local' }, { status: 400 })
    }
    const nomesLocais = locaisValidos.map((l) => l.nome!.trim().toLowerCase())
    if (new Set(nomesLocais).size !== nomesLocais.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar locais com o mesmo nome' },
        { status: 400 },
      )
    }

    // ── Alimentos (🔄 17.4 — productId; 🆕 17.6 — refugoKg) ──
    const alimentosInput: { productId?: string; refugoKg?: number }[] = Array.isArray(alimentos)
      ? alimentos
      : []
    const productIdsValidos = alimentosInput
      .map((a) => (a && typeof a.productId === 'string' ? a.productId.trim() : ''))
      .filter((pid) => pid.length > 0)

    if (productIdsValidos.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um alimento ao evento' },
        { status: 400 },
      )
    }
    if (new Set(productIdsValidos).size !== productIdsValidos.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo alimento mais de uma vez' },
        { status: 400 },
      )
    }

    // 🆕 17.6 — mapa productId → refugoKg (sanitizado: número finito >= 0)
    const refugoPorProduct = new Map<string, number>()
    for (const a of alimentosInput) {
      if (a && typeof a.productId === 'string') {
        const pid = a.productId.trim()
        const kg = Number(a.refugoKg)
        refugoPorProduct.set(pid, Number.isFinite(kg) && kg > 0 ? kg : 0)
      }
    }

    // 🛡️ Garante que todos os productIds existem (backend não confia no front)
    const produtosExistentes = await prisma.product.findMany({
      where: { id: { in: productIdsValidos } },
      select: { id: true, name: true },
    })
    if (produtosExistentes.length !== productIdsValidos.length) {
      return NextResponse.json(
        { error: 'Um ou mais produtos selecionados não existem no catálogo' },
        { status: 400 },
      )
    }

    // ── Diffs: locais ──
    const idsLocaisMantidos = new Set(
      locaisValidos.filter((l) => l.id).map((l) => l.id as string),
    )
    const locaisParaRemover = evento.locais.filter((l) => !idsLocaisMantidos.has(l.id))
    const bloqueioLocal = locaisParaRemover.find((l) => l._count.recebimentos > 0)
    if (bloqueioLocal) {
      return NextResponse.json(
        { error: `O local "${bloqueioLocal.nome}" tem recebimentos e não pode ser removido` },
        { status: 400 },
      )
    }

    // ── Diffs: alimentos (🔄 por productId) ──
    const productIdsMantidos = new Set(productIdsValidos)
    const alimParaRemover = evento.alimentos.filter((a) => !productIdsMantidos.has(a.productId))
    const bloqueioAlim = alimParaRemover.find((a) => a._count.recebimentos > 0)
    if (bloqueioAlim) {
      return NextResponse.json(
        {
          error: `O alimento "${bloqueioAlim.product.name}" tem recebimentos e não pode ser removido`,
        },
        { status: 400 },
      )
    }

    // ── Transação ──
    const atualizado = await prisma.$transaction(async (tx) => {
      // dados base (🆕 17.6 — grava obsRefugo geral)
      await tx.evento.update({
        where: { id },
        data: {
          nome: nome.trim(),
          descricao: descricao?.trim() || null,
          dataInicio: new Date(dataInicio),
          dataFim: dataFim ? new Date(dataFim) : null,
          integraEstoque: integraEstoque ?? true,
          obsRefugo: typeof obsRefugo === 'string' ? obsRefugo.trim() || null : null, // 🆕 17.6
        },
      })

      // remove locais (já validado: nenhum com recebimento)
      if (locaisParaRemover.length > 0) {
        await tx.localColeta.deleteMany({
          where: { id: { in: locaisParaRemover.map((l) => l.id) } },
        })
      }
      // upsert locais
      for (const l of locaisValidos) {
        if (l.id) {
          await tx.localColeta.update({
            where: { id: l.id },
            data: { nome: l.nome!.trim(), endereco: l.endereco?.toString().trim() || null },
          })
        } else {
          await tx.localColeta.create({
            data: {
              eventoId: id,
              nome: l.nome!.trim(),
              endereco: l.endereco?.toString().trim() || null,
            },
          })
        }
      }

      // remove alimentos (já validado: nenhum com recebimento)
      if (alimParaRemover.length > 0) {
        await tx.eventoAlimento.deleteMany({
          where: { id: { in: alimParaRemover.map((a) => a.id) } },
        })
      }
      // upsert alimentos por productId, preservando ordem do array
      const existentesPorProduct = new Map(evento.alimentos.map((a) => [a.productId, a]))
      for (let i = 0; i < productIdsValidos.length; i++) {
        const pid = productIdsValidos[i]
        const existente = existentesPorProduct.get(pid)
        const refugoKg = refugoPorProduct.get(pid) ?? 0 // 🆕 17.6
        if (existente) {
          // 🆕 17.6 — atualiza ordem + refugoKg
          await tx.eventoAlimento.update({
            where: { id: existente.id },
            data: { ordem: i, refugoKg },
          })
        } else {
          // 🆕 17.6 — cria já com refugoKg
          await tx.eventoAlimento.create({
            data: { eventoId: id, productId: pid, ordem: i, refugoKg },
          })
        }
      }

      return tx.evento.findUnique({
        where: { id },
        include: {
          locais: { orderBy: { createdAt: 'asc' } },
          alimentos: {
            orderBy: { ordem: 'asc' },
            include: { product: { select: { id: true, name: true, unit: true } } },
          },
          _count: {
            select: { recebimentos: true, operadores: true, locais: true, alimentos: true },
          },
        },
      })
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error('Erro ao editar evento:', error)
    return NextResponse.json({ error: 'Erro ao editar evento' }, { status: 500 })
  }
}

// ──────────────────────────────────────────────
// DELETE — Excluir evento (ADMIN, só sem recebimentos)
// ──────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const evento = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, _count: { select: { recebimentos: true } } },
    })
    if (!evento) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }
    if (evento._count.recebimentos > 0) {
      return NextResponse.json(
        { error: 'Evento com recebimentos não pode ser excluído' },
        { status: 400 },
      )
    }

    // locais, alimentos e operadores têm onDelete: Cascade → caem juntos
    await prisma.evento.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir evento:', error)
    return NextResponse.json({ error: 'Erro ao excluir evento' }, { status: 500 })
  }
}
