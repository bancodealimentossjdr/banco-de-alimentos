import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
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

export async function GET(request: Request) {
  const authResult = await requireView('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const session = await auth()
    const role = session?.user?.role

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

    const masked = maskFuncionarioList(employees, role)
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
    const employee = await prisma.employee.create({
      data: {
        name: body.name,
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
