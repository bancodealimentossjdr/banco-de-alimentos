import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit, requireDeleteRecord } from '@/lib/auth-helpers'

// ============================================
// GET - Buscar evento por ID (com locais + auditoria)
// ============================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('eventos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const evento = await prisma.evento.findUnique({
      where: { id },
      include: {
        locais: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { recebimentos: true } },
          },
        },
        criadoPor: { select: { id: true, name: true } },
        encerradoPor: { select: { id: true, name: true } },
        _count: {
          select: { recebimentos: true, operadores: true, locais: true },
        },
      },
    })

    if (!evento) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(evento)
  } catch (error) {
    console.error('Erro ao buscar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar evento' },
      { status: 500 }
    )
  }
}

// ============================================
// PUT - Atualizar evento (APENAS ADMIN)
// Edita dados básicos + reconcilia locais.
// Não deleta locais que já têm recebimentos.
// ============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🔐 Auth + permissão de edição (só admin tem 'eventos' em EDIT_PERMISSIONS)
  const authResult = await requireEdit('eventos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    // 🔒 Confirma existência
    const existing = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // 🚫 Evento encerrado não pode ser editado
    if (existing.status === 'ENCERRADO') {
      return NextResponse.json(
        { error: 'Eventos encerrados não podem ser editados' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      nome,
      descricao,
      dataInicio,
      dataFim,
      integraEstoque,
      locais,
    }: {
      nome?: string
      descricao?: string | null
      dataInicio?: string
      dataFim?: string | null
      integraEstoque?: boolean
      locais?: Array<{ id?: string; nome: string; endereco?: string | null }>
    } = body

    // Validações
    if (!nome || !nome.trim()) {
      return NextResponse.json(
        { error: 'Nome do evento é obrigatório' },
        { status: 400 }
      )
    }

    if (!dataInicio) {
      return NextResponse.json(
        { error: 'Data de início é obrigatória' },
        { status: 400 }
      )
    }

    // 🧮 Reconciliação de locais (se enviados)
    if (locais !== undefined) {
      // Locais válidos vindos do form
      const validLocais = locais.filter((l) => l.nome && l.nome.trim())

      // Locais atuais no banco (com contagem de recebimentos)
      const locaisAtuais = await prisma.localColeta.findMany({
        where: { eventoId: id },
        select: {
          id: true,
          _count: { select: { recebimentos: true } },
        },
      })

      const idsEnviados = new Set(
        validLocais.filter((l) => l.id).map((l) => l.id as string)
      )

      // 🔒 Locais a remover: estão no banco mas NÃO vieram no form
      const aRemover = locaisAtuais.filter((l) => !idsEnviados.has(l.id))

      // ⚠️ Bloqueia remoção de local que já tem recebimentos
      const comRecebimentos = aRemover.filter((l) => l._count.recebimentos > 0)
      if (comRecebimentos.length > 0) {
        return NextResponse.json(
          {
            error:
              'Não é possível remover locais que já possuem recebimentos registrados. Eles precisam ser mantidos para preservar o histórico.',
          },
          { status: 400 }
        )
      }

      // Transação: atualiza evento + reconcilia locais
      await prisma.$transaction([
        // 1) Atualiza dados do evento
        prisma.evento.update({
          where: { id },
          data: {
            nome: nome.trim(),
            descricao: descricao?.trim() || null,
            dataInicio: new Date(dataInicio),
            dataFim: dataFim ? new Date(dataFim) : null,
            ...(integraEstoque !== undefined && { integraEstoque }),
          },
        }),
        // 2) Remove locais sem recebimentos que saíram do form
        prisma.localColeta.deleteMany({
          where: { id: { in: aRemover.map((l) => l.id) } },
        }),
        // 3) Atualiza locais existentes (que vieram com id)
        ...validLocais
          .filter((l) => l.id)
          .map((l) =>
            prisma.localColeta.update({
              where: { id: l.id },
              data: {
                nome: l.nome.trim(),
                endereco: l.endereco?.trim() || null,
              },
            })
          ),
        // 4) Cria locais novos (sem id)
        ...validLocais
          .filter((l) => !l.id)
          .map((l) =>
            prisma.localColeta.create({
              data: {
                eventoId: id,
                nome: l.nome.trim(),
                endereco: l.endereco?.trim() || null,
              },
            })
          ),
      ])
    } else {
      // Sem locais no payload → atualiza só os dados do evento
      await prisma.evento.update({
        where: { id },
        data: {
          nome: nome.trim(),
          descricao: descricao?.trim() || null,
          dataInicio: new Date(dataInicio),
          dataFim: dataFim ? new Date(dataFim) : null,
          ...(integraEstoque !== undefined && { integraEstoque }),
        },
      })
    }

    // Retorna o evento atualizado completo
    const evento = await prisma.evento.findUnique({
      where: { id },
      include: {
        locais: { orderBy: { createdAt: 'asc' } },
        criadoPor: { select: { id: true, name: true } },
        encerradoPor: { select: { id: true, name: true } },
        _count: {
          select: { recebimentos: true, operadores: true, locais: true },
        },
      },
    })

    return NextResponse.json(evento)
  } catch (error) {
    console.error('Erro ao atualizar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar evento' },
      { status: 500 }
    )
  }
}

// ============================================
// PATCH - Transição de status do evento (APENAS ADMIN)
// Ações: { action: 'ativar' } | { action: 'encerrar' }
//   ativar:   RASCUNHO  → ATIVO
//   encerrar: ATIVO     → ENCERRADO (+ desativa operadores)
// ============================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('eventos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const existing = await prisma.evento.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { action }: { action?: 'ativar' | 'encerrar' } = body

    // ▶️ ATIVAR: RASCUNHO → ATIVO
    if (action === 'ativar') {
      if (existing.status !== 'RASCUNHO') {
        return NextResponse.json(
          { error: 'Apenas eventos em rascunho podem ser ativados' },
          { status: 400 }
        )
      }

      // 🔒 Precisa ter pelo menos 1 local pra ativar
      const totalLocais = await prisma.localColeta.count({
        where: { eventoId: id },
      })
      if (totalLocais === 0) {
        return NextResponse.json(
          { error: 'Adicione pelo menos um local de coleta antes de ativar o evento' },
          { status: 400 }
        )
      }

      const evento = await prisma.evento.update({
        where: { id },
        data: { status: 'ATIVO' },
      })
      return NextResponse.json(evento)
    }

    // ⏹️ ENCERRAR: ATIVO → ENCERRADO (+ desativa operadores)
    if (action === 'encerrar') {
      if (existing.status !== 'ATIVO') {
        return NextResponse.json(
          { error: 'Apenas eventos ativos podem ser encerrados' },
          { status: 400 }
        )
      }

      // ✅ requireEdit já garantiu que é admin (eventos só tem admin em EDIT)
      const adminId = authResult.user.id

      const [evento] = await prisma.$transaction([
        // 1) Encerra o evento (snapshot via encerradoEm + auditoria)
        prisma.evento.update({
          where: { id },
          data: {
            status: 'ENCERRADO',
            encerradoPorId: adminId,
            encerradoEm: new Date(),
          },
        }),
        // 2) Desativa todos os operadores do evento (voltam a visualizador)
        prisma.eventoOperador.updateMany({
          where: { eventoId: id, ativo: true },
          data: { ativo: false },
        }),
      ])

      return NextResponse.json(evento)
    }

    return NextResponse.json(
      { error: 'Ação inválida. Use "ativar" ou "encerrar".' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Erro ao alterar status do evento:', error)
    return NextResponse.json(
      { error: 'Erro ao alterar status do evento' },
      { status: 500 }
    )
  }
}

// ============================================
// DELETE - Excluir evento (APENAS ADMIN)
// Bloqueia se houver recebimentos (preserva histórico).
// ============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🚫 Apenas admin pode excluir
  const authResult = await requireDeleteRecord('eventos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const existing = await prisma.evento.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { recebimentos: true } },
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Evento não encontrado' },
        { status: 404 }
      )
    }

    // ⚠️ Não permite excluir evento com recebimentos (preserva histórico)
    if (existing._count.recebimentos > 0) {
      return NextResponse.json(
        {
          error:
            'Não é possível excluir um evento que já possui recebimentos registrados. Considere encerrá-lo.',
        },
        { status: 400 }
      )
    }

    // onDelete: Cascade remove locais e operadores automaticamente
    await prisma.evento.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir evento:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir evento' },
      { status: 500 }
    )
  }
}
