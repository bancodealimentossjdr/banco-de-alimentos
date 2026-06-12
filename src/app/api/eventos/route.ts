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
        // 🔑 SEM ISSO, evento.locais vem undefined → crash na página
        locais: {
          orderBy: { createdAt: 'asc' },
        },
        // 🆕 17.3 — alimentos do evento, na ordem definida pelo admin
        alimentos: {
          orderBy: { ordem: 'asc' },
        },
        criadoPor: { select: { id: true, name: true } },
        encerradoPor: { select: { id: true, name: true } },
        _count: {
          select: {
            recebimentos: true,
            operadores: true,
            locais: true,
            alimentos: true, // 🆕 17.3
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
      alimentos, // 🆕 17.3 — array de strings
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
      ? locais.filter(
          (l: { nome?: string }) => l.nome && l.nome.trim()
        )
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

    // 🆕 17.3 — Alimentos: filtra vazios, normaliza e valida duplicados
    const alimentosValidos = Array.isArray(alimentos)
      ? alimentos
          .map((a: string) => (typeof a === 'string' ? a.trim() : ''))
          .filter((a: string) => a.length > 0)
      : []

    // 🔍 Nomes de alimento não podem se repetir (case-insensitive)
    const nomesAlimentos = alimentosValidos.map((a: string) => a.toLowerCase())
    if (new Set(nomesAlimentos).size !== nomesAlimentos.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar alimentos com o mesmo nome' },
        { status: 400 }
      )
    }

    // 🔍 Pelo menos 1 alimento (sem alimento, a tela de campo fica inútil)
    if (alimentosValidos.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um alimento ao evento' },
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
          create: locaisValidos.map((l: { nome: string; endereco?: string }) => ({
            nome: l.nome.trim(),
            endereco: l.endereco?.trim() || null,
          })),
        },
        // 🆕 17.3 — alimentos criados na mesma transação, com ordem preservada
        alimentos: {
          create: alimentosValidos.map((nomeAlimento: string, index: number) => ({
            nome: nomeAlimento,
            ordem: index, // mantém a ordem que o admin digitou
          })),
        },
      },
      include: {
        locais: { orderBy: { createdAt: 'asc' } },
        alimentos: { orderBy: { ordem: 'asc' } }, // 🆕 17.3
        _count: {
          select: {
            locais: true,
            recebimentos: true,
            operadores: true,
            alimentos: true, // 🆕 17.3
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
