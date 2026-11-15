import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord, requireDeleteRecord } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import {
  maskNotesIfReadOnly,
  maskProdutor,
  maskFuncionario,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

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

    const session = await auth()
    const role = session?.user?.role

    // 1) Mascara notes se for somente leitura no módulo
    let harvestSegura = maskNotesIfReadOnly(harvest, role, 'colheita-solidaria')

    // 2) Visualizador: dados pessoais mascarados + R$ removido (igual à lista)
    if (shouldMaskPersonalData(role)) {
      harvestSegura = {
        ...harvestSegura,
        producer: harvestSegura.producer
          ? maskProdutor(harvestSegura.producer, role)
          : harvestSegura.producer,
        employee: harvestSegura.employee
          ? maskFuncionario(harvestSegura.employee, role)
          : harvestSegura.employee,
        employee2: harvestSegura.employee2
          ? maskFuncionario(harvestSegura.employee2, role)
          : harvestSegura.employee2,
        employee3: harvestSegura.employee3
          ? maskFuncionario(harvestSegura.employee3, role)
          : harvestSegura.employee3,
        indemnityValue: null, // 🔴 R$ nunca chega ao visualizador
        isMasked: true,
      }
    }

    return NextResponse.json(harvestSegura)
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

    // 🔒 Trava temporal usa `date` (dia da colheita), NÃO `createdAt`.
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

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Adicione pelo menos um item' }, { status: 400 })
    }

    const employeeIds = [employeeId, employee2Id, employee3Id].filter(Boolean)
    if (employeeIds.length !== new Set(employeeIds).size) {
      return NextResponse.json(
        { error: 'Não é possível selecionar o mesmo funcionário mais de uma vez' },
        { status: 400 }
      )
    }

    // 🧱 Atômico: ou troca os itens E atualiza, ou não faz nada.
    const harvest = await prisma.$transaction(async (tx) => {
      await tx.harvestItem.deleteMany({ where: { harvestId: id } })

      return tx.solidarityHarvest.update({
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

    const existing = await prisma.solidarityHarvest.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Colheita não encontrada' }, { status: 404 })
    }

    // 🚫 Apenas admin pode excluir (módulo time-locked).
    const authResult = await requireDeleteRecord('colheita-solidaria')
    if (authResult instanceof NextResponse) return authResult

    await prisma.solidarityHarvest.delete({ where: { id } })
    return NextResponse.json({ message: 'Colheita excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE colheita:', error)
    return NextResponse.json({ error: 'Erro ao excluir colheita' }, { status: 500 })
  }
}
