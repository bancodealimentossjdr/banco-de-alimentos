import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { canSeeHidden } from '@/lib/permissions'
import { canLookup } from '@/lib/rbac-lookup'
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

/**
 * 🧹 ONDA 23.7e-4 — `?incluir=` vazio virava `{ id: '' }` dentro do OR.
 * Não quebrava a query, mas sujava o where e mascarava depuração.
 */
function lerIncluir(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get('incluir')
  if (!raw) return null
  const id = raw.trim()
  return id.length > 0 ? id : null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // ─────────────────────────────────────────────────────────────
  // 🆕 ONDA 23.7e-4 — MODO LOOKUP
  //
  // Contrato separado para preencher <select> de formulário.
  // Payload: SÓ id + name + active. Sem _count (9 agregações), sem máscara.
  //
  // 🔐 Por que requireView('dashboard') e não auth() direto:
  //    'dashboard' está em VIEW_PERMISSIONS de TODAS as roles, então este
  //    gate significa apenas "está autenticado" — e reaproveita o helper
  //    que já trata sessão ausente e devolve 401 padronizado.
  //    O gate REAL de autorização é o canLookup() logo abaixo.
  //
  // ⚠️ O select é LITERAL e FECHADO. Se um campo sensível (cpf, phone,
  // salário, endereço) entrar aqui, o gate frouxo vira vazamento de dado
  // pessoal. Nunca troque por `include` nem por spread do registro.
  // ─────────────────────────────────────────────────────────────
  if (searchParams.get('lookup') === '1') {
    const authResult = await requireView('dashboard')
    if (authResult instanceof NextResponse) return authResult

    const role = authResult.user.role

    if (!canLookup(role, 'funcionarios')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    try {
      const incluir = lerIncluir(searchParams)

      // Lookup NUNCA mostra oculto — nem para o dev. Selecionar registro
      // oculto criaria vínculo ilegível para todas as outras roles.
      const base: Prisma.EmployeeWhereInput = { hiddenAt: null, active: true }
      const where: Prisma.EmployeeWhereInput = incluir
        ? { OR: [base, { id: incluir }] }
        : base

      const employees = await prisma.employee.findMany({
        where,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, active: true },
      })

      return NextResponse.json(employees)
    } catch (error) {
      console.error('Erro GET funcionários (lookup):', error)
      return NextResponse.json({ error: 'Erro ao buscar funcionários' }, { status: 500 })
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MODO NORMAL — gestão do cadastro
  // ─────────────────────────────────────────────────────────────

  // 🔐 requireView já resolveu a sessão — NÃO chamar auth() de novo.
  const authResult = await requireView('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role
  const podeVerOcultos = canSeeHidden(role)

  try {
    const apenasAtivos = searchParams.get('apenasAtivos') === '1'
    const incluir = lerIncluir(searchParams)
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
