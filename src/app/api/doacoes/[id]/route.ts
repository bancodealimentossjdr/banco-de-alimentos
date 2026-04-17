import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const donation = await prisma.donation.findUnique({
      where: { id },
      include: {
        donor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    })
    if (!donation) {
      return NextResponse.json({ error: 'Doacao nao encontrada' }, { status: 404 })
    }
    return NextResponse.json(donation)
  } catch (error) {
    console.error('Erro GET doacao:', error)
    return NextResponse.json({ error: 'Erro ao buscar doacao' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { donorId, employeeId, date, notes, items } = body

    await prisma.donationItem.deleteMany({
      where: { donationId: id },
    })

    const donation = await prisma.donation.update({
      where: { id },
      data: {
        donorId,
        employeeId: employeeId || null,
        date: date ? new Date(date + 'T12:00:00') : undefined,
        notes: notes || null,
        items: {
          create: items.map((item: { productId: string; quantity: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        donor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    })

    return NextResponse.json(donation)
  } catch (error) {
    console.error('Erro PUT doacao:', error)
    return NextResponse.json({ error: 'Erro ao atualizar doacao' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    await prisma.donation.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'Doacao excluida com sucesso' })
  } catch (error) {
    console.error('Erro DELETE doacao:', error)
    return NextResponse.json({ error: 'Erro ao excluir doacao' }, { status: 500 })
  }
}
