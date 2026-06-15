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
        alimentos: { orderBy: { ordem: 'asc' } },
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
// PATCH — Transição de status (ativar / encerrar)
// Body: { action: 'ativar' | 'encerrar' }
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
    const { action } = body as { action?: 'ativar' | 'encerrar' }

    if (action !== 'ativar' && action !== 'encerrar') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const evento = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, status: true },
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
    const { nome, descricao, dataInicio, dataFim, integraEstoque, locais, alimentos } = body

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
        alimentos: { include: { _count: { select: { recebimentos: true } } } },
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

    // ── Alimentos ──
    const alimentosInput: string[] = Array.isArray(alimentos) ? alimentos : []
    const alimentosValidos = alimentosInput
      .map((a) => (typeof a === 'string' ? a.trim() : ''))
      .filter((a) => a.length > 0)

    if (alimentosValidos.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um alimento ao evento' },
        { status: 400 },
      )
    }
    const nomesAlim = alimentosValidos.map((a) => a.toLowerCase())
    if (new Set(nomesAlim).size !== nomesAlim.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar alimentos com o mesmo nome' },
        { status: 400 },
      )
    }

    // ── Diffs: o que pode ser removido? ──
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

    // Alimentos: comparamos por nome (case-insensitive)
    const nomesAlimMantidos = new Set(nomesAlim)
    const alimParaRemover = evento.alimentos.filter(
      (a) => !nomesAlimMantidos.has(a.nome.toLowerCase()),
    )
    const bloqueioAlim = alimParaRemover.find((a) => a._count.recebimentos > 0)
    if (bloqueioAlim) {
      return NextResponse.json(
        { error: `O alimento "${bloqueioAlim.nome}" tem recebimentos e não pode ser removido` },
        { status: 400 },
      )
    }

    // ── Transação ──
    const atualizado = await prisma.$transaction(async (tx) => {
      // dados base
      await tx.evento.update({
        where: { id },
        data: {
          nome: nome.trim(),
          descricao: descricao?.trim() || null,
          dataInicio: new Date(dataInicio),
          dataFim: dataFim ? new Date(dataFim) : null,
          integraEstoque: integraEstoque ?? true,
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
            data: { eventoId: id, nome: l.nome!.trim(), endereco: l.endereco?.toString().trim() || null },
          })
        }
      }

      // remove alimentos (já validado: nenhum com recebimento)
      if (alimParaRemover.length > 0) {
        await tx.eventoAlimento.deleteMany({
          where: { id: { in: alimParaRemover.map((a) => a.id) } },
        })
      }
      // upsert alimentos por nome, preservando ordem do array
      const existentesPorNome = new Map(
        evento.alimentos.map((a) => [a.nome.toLowerCase(), a]),
      )
      for (let i = 0; i < alimentosValidos.length; i++) {
        const nomeAlim = alimentosValidos[i]
        const existente = existentesPorNome.get(nomeAlim.toLowerCase())
        if (existente) {
          await tx.eventoAlimento.update({
            where: { id: existente.id },
            data: { nome: nomeAlim, ordem: i },
          })
        } else {
          await tx.eventoAlimento.create({
            data: { eventoId: id, nome: nomeAlim, ordem: i },
          })
        }
      }

      return tx.evento.findUnique({
        where: { id },
        include: {
          locais: { orderBy: { createdAt: 'asc' } },
          alimentos: { orderBy: { ordem: 'asc' } },
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
