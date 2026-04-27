import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord, requireDeleteRecord } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('colheita-solidaria')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const harvest = await prisma.solidarityHarvest.findUnique({
      where: { id },
      include: {
        producer: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: { include: { product: true } },
      },
    })
    if (!harvest) {
      return NextResponse.json({ error: 'Colheita não encontrada' }, { status: 404 })
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

    // 🔒 Busca o registro ANTES — pega o `date` (dia da colheita) pra checar trava temporal.
    // IMPORTANTE: usamos `date`, NÃO `createdAt`. Operador só pode editar se a data
    // da colheita for hoje. Colheitas retroativas ficam bloqueadas mesmo recém-criadas.
    const existing = await prisma.solidarityHarvest.findUnique({
      where: { id },
      select: { date: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Colheita não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('colheita-solidaria', existing.date)
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const {
      producerId,
      employeeId,
      employee2Id,
      employee3Id,
      date,
      status,
      notes,
      indemnityValue,
      items,
    } = body

    // 🔍 Validação: funcionários não podem se repetir
    const employeeIds = [employeeId, employee2Id, employee3Id].filter(Boolean)
    const uniqueIds = new Set(employeeIds)
    if (employeeIds.length !== uniqueIds.size) {
      return NextResponse.json(
        { error: 'Não é possível selecionar o mesmo funcionário mais de uma vez' },
        { status: 400 }
      )
    }

    await prisma.harvestItem.deleteMany({
      where: { harvestId: id },
    })

    const harvest = await prisma.solidarityHarvest.update({
      where: { id },
      data: {
        producerId,
        employeeId: employeeId || null,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
        date: date ? new Date(date + 'T12:00:00') : undefined,
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
        employee2: true,
        employee3: true,
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

    // 🔒 Confirma que o registro existe (mesmo que só admin possa excluir,
    // mantemos a checagem pra retornar 404 correto).
    const existing = await prisma.solidarityHarvest.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Colheita não encontrada' }, { status: 404 })
    }

    // 🚫 Apenas admin pode excluir (módulo time-locked). Operador é bloqueado.
    const authResult = await requireDeleteRecord('colheita-solidaria')
    if (authResult instanceof NextResponse) return authResult

    await prisma.solidarityHarvest.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'Colheita excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE colheita:', error)
    return NextResponse.json({ error: 'Erro ao excluir colheita' }, { status: 500 })
  }
}
