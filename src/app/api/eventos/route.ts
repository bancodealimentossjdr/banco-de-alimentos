import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireAdmin } from '@/lib/auth-helpers'

// GET - Listar todos os eventos (qualquer autenticado pode ver)
export async function GET() {
  const authResult = await requireView('eventos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const eventos = await prisma.evento.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        locais: {
          orderBy: { createdAt: 'asc' },
        },
        // 🆕 17.4 — alimentos do evento, com o produto vinculado
        alimentos: {
          orderBy: { ordem: 'asc' },
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        criadoPor: { select: { id: true, name: true } },
        encerradoPor: { select: { id: true, name: true } },
        _count: {
          select: {
            recebimentos: true,
            operadores: true,
            locais: true,
            alimentos: true,
          },
        },
      },
    })

    return NextResponse.json(eventos)
  } catch (error) {
    console.error('Erro ao listar eventos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar eventos' },
      { status: 500 }
    )
  }
}

// POST - Criar novo evento + locais + alimentos (APENAS ADMIN)
export async function POST(request: NextRequest) {
  // 🔒 Só admin cria eventos
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const {
      nome,
      descricao,
      dataInicio,
      dataFim,
      integraEstoque,
      locais,
      alimentos, // 🆕 17.4 — array de { productId }
    } = body

    // Validações básicas
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

    // 🔍 Valida coerência das datas
    if (dataFim && new Date(dataFim) < new Date(dataInicio)) {
      return NextResponse.json(
        { error: 'A data de término não pode ser anterior à de início' },
        { status: 400 }
      )
    }

    // 🔍 Locais: filtra os que têm nome preenchido
    const locaisValidos = Array.isArray(locais)
      ? locais.filter((l: { nome?: string }) => l.nome && l.nome.trim())
      : []

    // 🔍 Nomes de local não podem se repetir
    const nomesLocais = locaisValidos.map((l: { nome: string }) =>
      l.nome.trim().toLowerCase()
    )
    if (new Set(nomesLocais).size !== nomesLocais.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar locais com o mesmo nome' },
        { status: 400 }
      )
    }

    // 🆕 17.4 — Alimentos: agora são productId do catálogo global
    const alimentosValidos = Array.isArray(alimentos)
      ? alimentos
          .map((a: { productId?: string }) =>
            typeof a?.productId === 'string' ? a.productId.trim() : ''
          )
          .filter((id: string) => id.length > 0)
      : []

    // 🔍 Pelo menos 1 alimento
    if (alimentosValidos.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um alimento ao evento' },
        { status: 400 }
      )
    }

    // 🔍 Produto não pode se repetir (respeita @@unique([eventoId, productId]))
    if (new Set(alimentosValidos).size !== alimentosValidos.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo alimento mais de uma vez' },
        { status: 400 }
      )
    }

    // 🔍 Garante que todos os produtos existem e estão ativos
    const produtos = await prisma.product.findMany({
      where: { id: { in: alimentosValidos }, active: true },
      select: { id: true },
    })
    if (produtos.length !== alimentosValidos.length) {
      return NextResponse.json(
        { error: 'Um ou mais alimentos selecionados são inválidos ou inativos' },
        { status: 400 }
      )
    }

    const evento = await prisma.evento.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : null,
        integraEstoque: integraEstoque ?? true,
        status: 'RASCUNHO', // 🟡 sempre nasce como rascunho
        criadoPorId: authResult.user.id,
        locais: {
          create: locaisValidos.map(
            (l: { nome: string; endereco?: string }) => ({
              nome: l.nome.trim(),
              endereco: l.endereco?.trim() || null,
            })
          ),
        },
        // 🆕 17.4 — vincula ao Product via connect, preservando a ordem
        alimentos: {
          create: alimentosValidos.map((productId: string, index: number) => ({
            ordem: index,
            product: { connect: { id: productId } },
          })),
        },
      },
      include: {
        locais: { orderBy: { createdAt: 'asc' } },
        alimentos: {
          orderBy: { ordem: 'asc' },
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
        _count: {
          select: {
            locais: true,
            recebimentos: true,
            operadores: true,
            alimentos: true,
          },
        },
      },
    })

    return NextResponse.json(evento, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar evento:', error)
    return NextResponse.json(
      { error: 'Erro ao criar evento' },
      { status: 500 }
    )
  }
}
