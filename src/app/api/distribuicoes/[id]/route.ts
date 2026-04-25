import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord } from '@/lib/auth-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const distribution = await prisma.distribution.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        employee2: { select: { id: true, name: true } },
        employee3: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    })
    if (!distribution) {
      return NextResponse.json({ error: 'Distribuição não encontrada' }, { status: 404 })
    }
    return NextResponse.json(distribution)
  } catch (error) {
    console.error('Erro GET distribuição:', error)
    return NextResponse.json({ error: 'Erro ao buscar distribuição' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Busca o registro ANTES pra checar a trava temporal
    const existing = await prisma.distribution.findUnique({
      where: { id },
      select: { createdAt: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Distribuição não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('distribuicoes', existing.createdAt)
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const { beneficiaryId, employeeId, employee2Id, employee3Id, date, notes, items } = body

    // 🔍 Validação: funcionários não podem se repetir
    const empIds = [employeeId, employee2Id, employee3Id].filter(Boolean)
    if (empIds.length !== new Set(empIds).size) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo funcionário mais de uma vez' },
        { status: 400 }
      )
    }

    await prisma.distributionItem.deleteMany({
      where: { distributionId: id },
    })

    const distribution = await prisma.distribution.update({
      where: { id },
      data: {
        beneficiaryId,
        employeeId: employeeId || null,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
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
        beneficiary: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        employee2: { select: { id: true, name: true } },
        employee3: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, unit: true } } } },
      },
    })

    return NextResponse.json(distribution)
  } catch (error) {
    console.error('Erro PUT distribuição:', error)
    return NextResponse.json({ error: 'Erro ao atualizar distribuição' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.distribution.findUnique({
      where: { id },
      select: { createdAt: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Distribuição não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('distribuicoes', existing.createdAt)
    if (authResult instanceof NextResponse) return authResult

    await prisma.distribution.delete({
      where: { id },
    })
    return NextResponse.json({ message: 'Distribuição excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE distribuição:', error)
    return NextResponse.json({ error: 'Erro ao excluir distribuição' }, { status: 500 })
  }
}
