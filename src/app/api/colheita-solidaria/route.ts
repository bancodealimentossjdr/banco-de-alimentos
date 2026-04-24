import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { maskNotesListIfReadOnly, maskProdutor, shouldMaskPersonalData } from '@/lib/mask-by-role'

export async function GET() {
  const authResult = await requireView('colheita-solidaria')
  if (authResult instanceof NextResponse) return authResult

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

    // 🔐 Aplica máscaras conforme o role
    const session = await auth()
    const role = session?.user?.role

    // 1) Mascara notes se for somente leitura no módulo
    let colheitasSeguras = maskNotesListIfReadOnly(colheitas, role, 'colheita-solidaria')

    // 2) Mascara dados pessoais do produtor se for visualizador
    if (shouldMaskPersonalData(role)) {
      colheitasSeguras = colheitasSeguras.map((c) => ({
        ...c,
        producer: c.producer ? maskProdutor(c.producer, role) : c.producer,
      }))
    }

    return NextResponse.json(colheitasSeguras)
  } catch (error) {
    console.error('Erro ao buscar colheitas:', error)
    return NextResponse.json({ error: 'Erro ao buscar colheitas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireEdit('colheita-solidaria')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { producerId, employeeId, date, status, notes, items, indemnityValue } = body

    if (!producerId) {
      return NextResponse.json({ error: 'Produtor é obrigatório' }, { status: 400 })
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
          create: items.map((item: { productId: string; quantity: number; boxes?: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
            boxes: item.boxes ?? null,
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
