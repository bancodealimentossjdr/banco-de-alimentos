import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const colheitas = await prisma.solidarityHarvest.findMany({
      orderBy: { date: 'desc' },
      include: {
        producer: true,
        employee: true,
        items: {
          include: { product: true },
        },
      },
    })
    return NextResponse.json(colheitas)
  } catch (error) {
    console.error('Erro ao buscar colheitas:', error)
    return NextResponse.json({ error: 'Erro ao buscar colheitas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { producerId, employeeId, date, status, notes, items, indemnityValue } = body

    if (!producerId) {
      return NextResponse.json({ error: 'Produtor eh obrigatorio' }, { status: 400 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um item' }, { status: 400 })
    }

    const dateValue = date ? new Date(date + 'T12:00:00') : new Date()

    const colheita = await prisma.solidarityHarvest.create({
      data: {
        producerId,
        employeeId: employeeId || null,
        date: dateValue,
        status: status || 'agendada',
        notes: notes || null,
        indemnityValue: indemnityValue ? parseFloat(String(indemnityValue)) : null,
        items: {
          create: items.map((item: { productId: string; quantity: number; weighed?: boolean }) => ({
            productId: item.productId,
            quantity: item.quantity,
            weighed: item.weighed || false,
          })),
        },
      },
      include: {
        producer: true,
        employee: true,
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(colheita, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar colheita:', error)
    return NextResponse.json({ error: 'Erro ao criar colheita' }, { status: 500 })
  }
}
