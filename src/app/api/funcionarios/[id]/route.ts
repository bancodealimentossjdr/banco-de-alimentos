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
        _count: {
          select: {
            donationsAsEmployee1: true,
            donationsAsEmployee2: true,
            donationsAsEmployee3: true,
            distributionsAsEmployee1: true,
            distributionsAsEmployee2: true,
            distributionsAsEmployee3: true,
            harvestsAsEmployee1: true,
            harvestsAsEmployee2: true,
            harvestsAsEmployee3: true,
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    // Soma todas as participações em coletas, entregas e colheitas
    const totalDonations =
      employee._count.donationsAsEmployee1 +
      employee._count.donationsAsEmployee2 +
      employee._count.donationsAsEmployee3

    const totalDistributions =
      employee._count.distributionsAsEmployee1 +
      employee._count.distributionsAsEmployee2 +
      employee._count.distributionsAsEmployee3

    const totalHarvests =
      employee._count.harvestsAsEmployee1 +
      employee._count.harvestsAsEmployee2 +
      employee._count.harvestsAsEmployee3

    const total = totalDonations + totalDistributions + totalHarvests

    if (total > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: este funcionário possui ${totalDonations} coleta(s), ${totalDistributions} entrega(s) e ${totalHarvests} colheita(s) vinculada(s).`,
        },
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
