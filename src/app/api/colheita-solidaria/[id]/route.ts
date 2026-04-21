import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const harvest = await prisma.solidarityHarvest.findUnique({
      where: { id },
      include: {
        producer: true,
        employee: true,
        items: { include: { product: true } },
      },
    })
    if (!harvest) {
      return NextResponse.json({ error: 'Colheita nao encontrada' }, { status: 404 })
    }
    return NextResponse.json(harvest)
  } catch (error) {
    console.error('Erro GET colheita:', error)
    return NextResponse.json({ error: 'Erro ao buscar colheita' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { producerId, employeeId, date, status, notes, indemnityValue, items } = body

    await prisma.harvestItem.deleteMany({
      where: { harvestId: id },
    })

    const harvest = await prisma.solidarityHarvest.update({
      where: { id },
      data: {
        producerId,
        employeeId: employeeId || null,
        date: date ? new Date(date + 'T12:00:00') : undefined,
        status: status || 'agendada',
        notes: notes || null,
        indemnityValue: indemnityValue ? parseFloat(String(indemnityValue)) : null,
        items: {
          create: items.map((item: { productId: string; quantity: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        producer: true,
        employee: true,
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(harvest)
  } catch (error) {
    console.error('Erro PUT colheita:', error)
    return NextResponse.json({ error: 'Erro ao atualizar colheita' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.solidarityHarvest.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'Colheita excluida com sucesso' })
  } catch (error) {
    console.error('Erro DELETE colheita:', error)
    return NextResponse.json({ error: 'Erro ao excluir colheita' }, { status: 500 })
  }
}
