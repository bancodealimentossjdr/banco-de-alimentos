import { NextResponse } from 'next/server'
import { requireView, requireEdit, requireAdminOrDev } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { maskFuncionario } from '@/lib/mask-by-role'
import { podeVerRegistro } from '@/lib/visibilidade'

const NAO_ENCONTRADO = () =>
  NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })

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

/** 🔁 Mesma consolidação da rota de lista (ONDA 22-g). */
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

/** 🆕 GET não existia nesta rota — necessário para o guard de leitura. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: COUNT_SELECT } },
    })

    if (!employee) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, employee)) return NAO_ENCONTRADO()

    const comUsos = {
      ...employee,
      ...derivarUsos(employee._count as ContagemFuncionario),
    }

    return NextResponse.json(maskFuncionario(comUsos, role))
  } catch (error) {
    console.error('Erro GET funcionário:', error)
    return NextResponse.json({ error: 'Erro ao buscar funcionário' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, employee)) return NAO_ENCONTRADO()

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json(
        { error: 'O nome do funcionário é obrigatório' },
        { status: 400 },
      )
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        name,
        role: body.role || null,
        phone: body.phone || null,
        active: typeof body.active === 'boolean' ? body.active : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT funcionário:', error)
    return NextResponse.json({ error: 'Erro ao atualizar funcionário' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: COUNT_SELECT } },
    })

    if (!employee) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, employee)) return NAO_ENCONTRADO()

    const { usos, totalUsos } = derivarUsos(employee._count as ContagemFuncionario)

    if (totalUsos > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: este funcionário possui ${usos.doacoes} coleta(s), ${usos.distribuicoes} entrega(s) e ${usos.colheitas} colheita(s) vinculada(s).`,
        },
        { status: 400 },
      )
    }

    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ message: 'Funcionário excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE funcionário:', error)
    return NextResponse.json({ error: 'Erro ao excluir funcionário' }, { status: 500 })
  }
}

/**
 * PATCH → alterna apenas o status (ativo/inativo). Admin ou DEV.
 * Alternativa segura ao DELETE: preserva todo o histórico de vínculos.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo "active" (boolean) é obrigatório' },
        { status: 400 },
      )
    }

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, employee)) return NAO_ENCONTRADO()

    const updated = await prisma.employee.update({
      where: { id },
      data: { active: body.active },
      select: { id: true, name: true, active: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PATCH funcionário:', error)
    return NextResponse.json({ error: 'Erro ao alterar status' }, { status: 500 })
  }
}
