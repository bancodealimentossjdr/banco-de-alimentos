import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEdit } from '@/lib/auth-helpers'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const body = await request.json()

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        name: body.name,
        role: body.role || null,
        phone: body.phone || null,
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
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        _count: { select: { donations: true, distributions: true } },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const total = employee._count.donations + employee._count.distributions
    if (total > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: este funcionário possui ${employee._count.donations} coleta(s) e ${employee._count.distributions} entrega(s) vinculada(s).` },
        { status: 400 }
      )
    }

    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ message: 'Funcionário excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE funcionário:', error)
    return NextResponse.json({ error: 'Erro ao excluir funcionário' }, { status: 500 })
  }
}
