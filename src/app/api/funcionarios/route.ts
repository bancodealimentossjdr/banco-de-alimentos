import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { canSeeHidden } from '@/lib/permissions'
import { filtroLista, lerModoOcultos } from '@/lib/visibilidade'
import { maskFuncionarioList } from '@/lib/mask-by-role'

const COUNT_SELECT = {
  donationsAsEmployee1: true,
  donationsAsEmployee2: true,
  donationsAsEmployee3: true,
  distributionsAsEmployee1: true,
  distributionsAsEmployee2: true,
  distributionsAsEmployee3: true,
  harvestsAsEmployee1: true,
  harvestsAsEmployee2: true,
  harvestsAsEmployee3: true,
} as const

type ContagemFuncionario = Record<keyof typeof COUNT_SELECT, number>

/**
 * 🐛 ONDA 22 (22-g) — o `_count` do Prisma devolve 9 chaves separadas
 * (employee1/2/3 de doação, distribuição e colheita). Nenhuma delas
 * representa "quantas vezes este funcionário foi usado".
 */
function derivarUsos(count: ContagemFuncionario) {
  const doacoes =
    count.donationsAsEmployee1 + count.donationsAsEmployee2 + count.donationsAsEmployee3
  const distribuicoes =
    count.distributionsAsEmployee1 +
    count.distributionsAsEmployee2 +
    count.distributionsAsEmployee3
  const colheitas =
    count.harvestsAsEmployee1 + count.harvestsAsEmployee2 + count.harvestsAsEmployee3

  return {
    usos: { doacoes, distribuicoes, colheitas },
    totalUsos: doacoes + distribuicoes + colheitas,
  }
}

export async function GET(request: Request) {
  // 🔐 requireView já resolveu a sessão — NÃO chamar auth() de novo.
  const authResult = await requireView('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role
  const podeVerOcultos = canSeeHidden(role)

  try {
    const { searchParams } = new URL(request.url)
    const apenasAtivos = searchParams.get('apenasAtivos') === '1'
    const incluir = searchParams.get('incluir')
    const modo = lerModoOcultos(searchParams)

    // 👁️ ONDA 23.7e-3 — filtro centralizado em lib/visibilidade
    const visibilidade = filtroLista(role, modo, apenasAtivos) as Prisma.EmployeeWhereInput
    const filtroAtivo: Prisma.EmployeeWhereInput = apenasAtivos ? { active: true } : {}

    // `incluir` fura os filtros por id — permite editar registro antigo
    // vinculado a funcionário inativo/oculto sem perder a referência.
    const where: Prisma.EmployeeWhereInput = incluir
      ? { OR: [{ AND: [visibilidade, filtroAtivo] }, { id: incluir }] }
      : { AND: [visibilidade, filtroAtivo] }

    const [employees, contadores] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: COUNT_SELECT } },
      }),
      // 🔢 contadores das abas — só o dev precisa deles
      podeVerOcultos
        ? Promise.all([
            prisma.employee.count({ where: { hiddenAt: null } }),
            prisma.employee.count({ where: { hiddenAt: { not: null } } }),
          ])
        : Promise.resolve(null),
    ])

    const comUsos = employees.map((e) => ({
      ...e,
      ...derivarUsos(e._count as ContagemFuncionario),
    }))

    // Payload continua array puro (compatibilidade).
    // Contadores viajam em header para não quebrar consumidores.
    const res = NextResponse.json(maskFuncionarioList(comUsos, role))
    if (contadores) {
      res.headers.set('X-Visiveis', String(contadores[0]))
      res.headers.set('X-Ocultos', String(contadores[1]))
    }
    return res
  } catch (error) {
    console.error('Erro GET funcionários:', error)
    return NextResponse.json({ error: 'Erro ao buscar funcionários' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    // ✅ ONDA 22 — nome é obrigatório e não pode ser vazio
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json(
        { error: 'O nome do funcionário é obrigatório' },
        { status: 400 },
      )
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        role: body.role || null,
        phone: body.phone || null,
        active: typeof body.active === 'boolean' ? body.active : true,
      },
    })
    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Erro POST funcionário:', error)
    return NextResponse.json({ error: 'Erro ao criar funcionário' }, { status: 500 })
  }
}
