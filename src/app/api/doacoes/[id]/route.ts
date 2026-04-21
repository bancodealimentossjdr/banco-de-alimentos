import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('doacoes')
  if (authResult instanceof NextResponse) return authResult

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
      return NextResponse.json({ error: 'Doação não encontrada' }, { status: 404 })
    }
    return NextResponse.json(donation)
  } catch (error) {
    console.error('Erro GET doação:', error)
    return NextResponse.json({ error: 'Erro ao buscar doação' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Busca o registro ANTES pra checar a trava temporal
    const existing = await prisma.donation.findUnique({
      where: { id },
      select: { createdAt: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Doação não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('doacoes', existing.createdAt)
    if (authResult instanceof NextResponse) return authResult

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
          create: items.map((item: { productId: string; quantity: number; boxes?: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
            boxes: item.boxes ?? null,
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
    console.error('Erro PUT doação:', error)
    return NextResponse.json({ error: 'Erro ao atualizar doação' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Busca o registro ANTES pra checar a trava temporal
    const existing = await prisma.donation.findUnique({
      where: { id },
      select: { createdAt: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Doação não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('doacoes', existing.createdAt)
    if (authResult instanceof NextResponse) return authResult

    await prisma.donation.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'Doação excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE doação:', error)
    return NextResponse.json({ error: 'Erro ao excluir doação' }, { status: 500 })
  }
}
