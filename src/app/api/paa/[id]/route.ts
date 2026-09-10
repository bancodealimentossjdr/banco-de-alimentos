import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord, requireDeleteRecord } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { calcularItensPaa, serializeEntregaPaa } from '@/lib/paa-calc'
import {
  maskEntregaPaa,
  maskProdutor,
  maskFuncionario,
  maskNotesIfReadOnly,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

const INCLUDE = {
  producer: true,
  employee: true,
  employee2: true,
  createdBy: { select: { id: true, name: true } },
  itens: {
    include: { product: { select: { id: true, name: true, paaUnidade: true, unit: true } } },
    orderBy: { id: 'asc' as const },
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const entrega = await prisma.entregaPaa.findUnique({ where: { id }, include: INCLUDE })
    if (!entrega) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    const session = await auth()
    const role = session?.user?.role

    let segura: any = serializeEntregaPaa(entrega)

    const comNotes = maskNotesIfReadOnly({ ...segura, notes: segura.observacoes }, role, 'paa')
    segura = { ...segura, observacoes: comNotes.notes }

    segura = maskEntregaPaa(segura, role)

    if (shouldMaskPersonalData(role)) {
      segura = {
        ...segura,
        numeroNota: segura.numeroNota ? '***' : null,
        producer: segura.producer ? maskProdutor(segura.producer, role) : segura.producer,
        employee: segura.employee ? maskFuncionario(segura.employee, role) : segura.employee,
        employee2: segura.employee2 ? maskFuncionario(segura.employee2, role) : segura.employee2,
      }
    }

    return NextResponse.json(segura)
  } catch (error) {
    console.error('Erro GET entrega PAA:', error)
    return NextResponse.json({ error: 'Erro ao buscar entrega' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 🔒 Trava temporal pela DATA DA ENTREGA (não createdAt) — mesmo critério
    // da colheita solidária: entrega retroativa fica bloqueada para operador.
    const existing = await prisma.entregaPaa.findUnique({
      where: { id },
      select: { dataEntrega: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    const authResult = await requireEditRecord('paa', existing.dataEntrega)
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const { producerId, dataEntrega, numeroNota, observacoes, employeeId, employee2Id, itens } = body

    if (!producerId) {
      return NextResponse.json({ error: 'Produtor é obrigatório' }, { status: 400 })
    }
    if (employeeId && employee2Id && employeeId === employee2Id) {
      return NextResponse.json(
        { error: 'Não é possível selecionar o mesmo funcionário duas vezes' },
        { status: 400 }
      )
    }

    // Na EDIÇÃO permitimos produtor inativo (corrigir histórico), mas nunca
    // um produtor que não atende o PAA.
    const producer = await prisma.producer.findUnique({
      where: { id: producerId },
      select: { id: true, name: true, atendePaa: true },
    })
    if (!producer) {
      return NextResponse.json({ error: 'Produtor não encontrado' }, { status: 400 })
    }
    if (!producer.atendePaa) {
      return NextResponse.json(
        { error: `"${producer.name}" não está marcado como fornecedor do PAA.` },
        { status: 400 }
      )
    }

    // ♻️ Recalcula com os preços VIGENTES. Se a tabela CONAB mudou de safra,
    // reeditar a entrega recongelamento os preços atuais — comportamento
    // intencional: quem edita assume o preço do momento da edição.
    const calc = await calcularItensPaa(prisma, itens, { exigirAtivo: false })
    if ('error' in calc) {
      return NextResponse.json({ error: calc.error }, { status: 400 })
    }

    const entrega = await prisma.$transaction(async (tx) => {
      await tx.entregaPaaItem.deleteMany({ where: { entregaPaaId: id } })
      return tx.entregaPaa.update({
        where: { id },
        data: {
          producerId,
          dataEntrega: dataEntrega ? new Date(dataEntrega + 'T12:00:00') : undefined,
          numeroNota: numeroNota?.trim() || null,
          observacoes: observacoes?.trim() || null,
          employeeId: employeeId || null,
          employee2Id: employee2Id || null,
          valorTotal: calc.valorTotal,
          pesoTotalKg: calc.pesoTotalKg,
          itens: { create: calc.itens },
        },
        include: INCLUDE,
      })
    })

    return NextResponse.json(serializeEntregaPaa(entrega))
  } catch (error) {
    console.error('Erro PUT entrega PAA:', error)
    return NextResponse.json({ error: 'Erro ao atualizar entrega' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.entregaPaa.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    // 🚫 Módulo time-locked: apenas dev/admin excluem. Itens caem por Cascade.
    const authResult = await requireDeleteRecord('paa')
    if (authResult instanceof NextResponse) return authResult

    await prisma.entregaPaa.delete({ where: { id } })
    return NextResponse.json({ message: 'Entrega excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE entrega PAA:', error)
    return NextResponse.json({ error: 'Erro ao excluir entrega' }, { status: 500 })
  }
}
