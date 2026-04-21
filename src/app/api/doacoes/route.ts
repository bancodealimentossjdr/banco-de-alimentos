import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const donations = await prisma.donation.findMany({
      include: {
        donor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(donations)
  } catch (error) {
    console.error('Erro GET doações:', error)
    return NextResponse.json({ error: 'Erro ao buscar doações' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Usa meio-dia para evitar que o fuso horário mude o dia
    const dateValue = new Date(body.date + 'T12:00:00')

    const donation = await prisma.donation.create({
      data: {
        donorId: body.donorId,
        employeeId: body.employeeId || null,
        date: dateValue,
        notes: body.notes || null,
        items: {
          create: body.items.map((item: { productId: string; quantity: number; boxes?: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
            boxes: item.boxes ?? null,
          })),
        },
      },
      include: {
        donor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
    })

    return NextResponse.json(donation, { status: 201 })
  } catch (error) {
    console.error('Erro POST doação:', error)
    return NextResponse.json({ error: 'Erro ao criar doação' }, { status: 500 })
  }
}
