import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const distribution = await prisma.distribution.findUnique({ where: { id } })
    if (!distribution) {
      return NextResponse.json({ error: 'Distribuição não encontrada' }, { status: 404 })
    }

    const dateValue = new Date(body.date + 'T12:00:00')

    await prisma.$transaction([
      prisma.distributionItem.deleteMany({ where: { distributionId: id } }),
      prisma.distribution.update({
        where: { id },
        data: {
          beneficiaryId: body.beneficiaryId,
          employeeId: body.employeeId || null,
          date: dateValue,
          notes: body.notes || null,
        },
      }),
      ...body.items.map((item: { productId: string; quantity: number }) =>
        prisma.distributionItem.create({
          data: {
            distributionId: id,
            productId: item.productId,
            quantity: item.quantity,
          },
        })
      ),
    ])

    const updated = await prisma.distribution.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT distribuição:', error)
    return NextResponse.json({ error: 'Erro ao atualizar distribuição' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const distribution = await prisma.distribution.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!distribution) {
      return NextResponse.json({ error: 'Distribuição não encontrada' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.distributionItem.deleteMany({ where: { distributionId: id } }),
      prisma.distribution.delete({ where: { id } }),
    ])

    return NextResponse.json({ message: 'Distribuição excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE distribuição:', error)
    return NextResponse.json({ error: 'Erro ao excluir distribuição' }, { status: 500 })
  }
}