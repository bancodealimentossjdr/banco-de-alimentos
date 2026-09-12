import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { canToggleVisibility } from '@/lib/permissions'
import { maskDoadorList } from '@/lib/mask-by-role'

export async function GET(request: Request) {
  // 🔐 requireView já resolveu a sessão — não chamar auth() de novo.
  const authResult = await requireView('doadores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role
  const podeVerOcultos = canToggleVisibility(role)

  try {
    const { searchParams } = new URL(request.url)
    const apenasAtivos = searchParams.get('apenasAtivos') === '1'
    const incluir = searchParams.get('incluir')
    const ocultos = searchParams.get('ocultos')

    // 👁️ ONDA 23.7e-3 — visibilidade
    const filtroVisibilidade: Prisma.DonorWhereInput = (() => {
      if (apenasAtivos || !podeVerOcultos) return { hiddenAt: null }
      if (ocultos === 'apenas') return { hiddenAt: { not: null } }
      if (ocultos === 'todos') return {}
      return { hiddenAt: null }
    })()

    const filtroAtivo: Prisma.DonorWhereInput = apenasAtivos
      ? { active: true }
      : {}

    const where: Prisma.DonorWhereInput = incluir
      ? { OR: [{ AND: [filtroVisibilidade, filtroAtivo] }, { id: incluir }] }
      : { AND: [filtroVisibilidade, filtroAtivo] }

    const [donors, contadores] = await Promise.all([
      prisma.donor.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: { donations: true } } },
      }),
      podeVerOcultos
        ? Promise.all([
            prisma.donor.count({ where: { hiddenAt: null } }),
            prisma.donor.count({ where: { hiddenAt: { not: null } } }),
          ])
        : Promise.resolve(null),
    ])

    const masked = maskDoadorList(donors, role)

    const res = NextResponse.json(masked)
    if (contadores) {
      res.headers.set('X-Visiveis', String(contadores[0]))
      res.headers.set('X-Ocultos', String(contadores[1]))
    }
    return res
  } catch (error) {
    console.error('Erro GET doadores:', error)
    return NextResponse.json({ error: 'Erro ao buscar doadores' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json(
        { error: 'O nome do doador é obrigatório' },
        { status: 400 },
      )
    }

    const donor = await prisma.donor.create({
      data: {
        name,
        type: body.type,
        category: body.category,
        contact: body.contact || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        active: typeof body.active === 'boolean' ? body.active : true,
      },
    })
    return NextResponse.json(donor, { status: 201 })
  } catch (error) {
    console.error('Erro POST doador:', error)
    return NextResponse.json({ error: 'Erro ao criar doador' }, { status: 500 })
  }
}
