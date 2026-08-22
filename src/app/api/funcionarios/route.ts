import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
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
 * representa "quantas vezes este funcionário foi usado", o que fazia
 * o consumidor ler um campo inexistente.
 *
 * Aqui consolidamos no servidor:
 *   - totalUsos          → soma das 9 contagens (bloqueia exclusão)
 *   - usos.doacoes       → soma dos 3 slots de doação
 *   - usos.distribuicoes → soma dos 3 slots de distribuição
 *   - usos.colheitas     → soma dos 3 slots de colheita
 *
 * `_count` continua no payload para não quebrar consumidores existentes.
 */
function derivarUsos(count: ContagemFuncionario) {
  const doacoes =
    count.donationsAsEmployee1 +
    count.donationsAsEmployee2 +
    count.donationsAsEmployee3

  const distribuicoes =
    count.distributionsAsEmployee1 +
    count.distributionsAsEmployee2 +
    count.distributionsAsEmployee3

  const colheitas =
    count.harvestsAsEmployee1 +
    count.harvestsAsEmployee2 +
    count.harvestsAsEmployee3

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

  try {
    const { searchParams } = new URL(request.url)
    const apenasAtivos = searchParams.get('apenasAtivos') === '1'
    const incluir = searchParams.get('incluir')

    const employees = await prisma.employee.findMany({
      where: apenasAtivos
        ? incluir
          ? { OR: [{ active: true }, { id: incluir }] }
          : { active: true }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: COUNT_SELECT } },
    })

    const comUsos = employees.map((e) => ({
      ...e,
      ...derivarUsos(e._count as ContagemFuncionario),
    }))

    const masked = maskFuncionarioList(comUsos, role)
    return NextResponse.json(masked)
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

    // ✅ ONDA 22 — validação mínima: nome é obrigatório e não pode ser vazio
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
