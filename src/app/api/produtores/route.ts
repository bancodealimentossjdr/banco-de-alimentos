import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { canLookup } from '@/lib/rbac-lookup'
import { maskProdutorList } from '@/lib/mask-by-role'
import { filtroVisibilidade, pediuOcultos } from '@/lib/visibilidade'

/** ?incluir= vazio virava { id: '' } no where — trata como ausente. */
function lerIncluir(sp: URLSearchParams): string | null {
  const v = sp.get('incluir')?.trim()
  return v && v.length > 0 ? v : null
}

// GET - Listar produtores
// ?lookup=1     → select fechado (id+name) para formulários de lançamento
// ?paa=true     → só produtores que atendem PAA
// ?active=true  → só ativos
// ?ocultos=true → inclui ocultos (IGNORADO se não for dev)
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams

  // 🔎 23.7e-4 — modo lookup: quem pode LANÇAR pode listar id+name do cadastro.
  if (sp.get('lookup') === '1') {
    const auth = await requireView('dashboard')
    if (auth instanceof NextResponse) return auth

    const role = auth.user.role
    if (!canLookup(role, 'produtores')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    try {
      const incluir = lerIncluir(sp)
      const base: Record<string, unknown> = { hiddenAt: null, active: true }
      if (sp.get('paa') === 'true') base.atendePaa = true

      const where = incluir ? { OR: [base, { id: incluir }] } : base

      const produtores = await prisma.producer.findMany({
        where,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, active: true, atendePaa: true },
      })
      return NextResponse.json(produtores)
    } catch (error) {
      console.error('Erro GET produtores (lookup):', error)
      return NextResponse.json({ error: 'Erro ao buscar produtores' }, { status: 500 })
    }
  }

  // 🔐 fluxo padrão — lista completa, exige view do módulo
  const authResult = await requireView('produtores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const where: Record<string, unknown> = {
      ...filtroVisibilidade(role, pediuOcultos(sp)),
    }

    if (sp.get('paa') === 'true') where.atendePaa = true
    if (sp.get('paa') === 'false') where.atendePaa = false
    if (sp.get('active') === 'true') where.active = true

    const produtores = await prisma.producer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { harvests: true, entregasPaa: true } },
      },
    })

    return NextResponse.json(maskProdutorList(produtores, role))
  } catch (error) {
    console.error('Erro ao buscar produtores:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produtores' },
      { status: 500 },
    )
  }
}

// POST - Criar novo produtor
export async function POST(request: NextRequest) {
  const authResult = await requireEdit('produtores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { name, phone, address, property, atendePaa } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const produtor = await prisma.producer.create({
      data: {
        name: name.trim(),
        phone: phone || null,
        address: address || null,
        property: property || null,
        atendePaa: Boolean(atendePaa),
      },
      include: {
        _count: { select: { harvests: true, entregasPaa: true } },
      },
    })

    return NextResponse.json(produtor, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produtor:', error)
    return NextResponse.json({ error: 'Erro ao criar produtor' }, { status: 500 })
  }
}
