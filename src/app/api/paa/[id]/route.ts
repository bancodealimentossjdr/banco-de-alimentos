import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEditRecord, requireDeleteRecord } from '@/lib/auth-helpers'
import { dataCivilParaTrava } from '@/lib/permissions'
import { calcularItensPaa, serializeEntregaPaa } from '@/lib/paa-calc'
import {
  maskEntregaPaa,
  maskProdutor,
  maskFuncionario,
  maskNotesIfReadOnly,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

// 🛡️ 23.9a — minimização: só os campos que a tela usa.
const INCLUDE = {
  producer: { select: { id: true, name: true } },
  employee: { select: { id: true, name: true } },
  employee2: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  assinaturaPor: { select: { id: true, name: true } },
  itens: {
    include: { product: { select: { id: true, name: true, paaUnidade: true, unit: true } } },
    orderBy: { id: 'asc' as const },
  },
}

const MSG_TRAVADA = 'Entrega assinada. Retire a assinatura antes de alterar.'

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult
  // 🛡️ Princípio 1: role vem do gate, não de auth() cru
  const role = authResult.user.role

  try {
    const { id } = await params
    const entrega = await prisma.entregaPaa.findUnique({ where: { id }, include: INCLUDE })
    if (!entrega) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    // 🛡️ G1-8c — imagem e hash da assinatura NUNCA saem por aqui
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { assinaturaData, assinaturaHash, ...semAssinatura } = entrega

    let segura: any = serializeEntregaPaa(semAssinatura as any)
    segura = { ...segura, assinada: entrega.status !== 'RASCUNHO' }

    const comNotes = maskNotesIfReadOnly({ ...segura, notes: segura.observacoes }, role, 'paa')
    segura = { ...segura, observacoes: comNotes.notes }

    segura = maskEntregaPaa(segura, role)

    if (shouldMaskPersonalData(role)) {
      segura = {
        ...segura,
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

    // 🔒 Trava temporal pela DATA DA ENTREGA (não createdAt).
    const existing = await prisma.entregaPaa.findUnique({
      where: { id },
      select: { dataEntrega: true, status: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Entrega não encontrada' }, { status: 404 })
    }

    // 🕛 @db.Date → meio-dia BRT (senão o operador trava no próprio dia)
    const authResult = await requireEditRecord('paa', dataCivilParaTrava(existing.dataEntrega))
    if (authResult instanceof NextResponse) return authResult

    // 🔏 G1-8c — assinada/finalizada é imutável (pré-checagem; a definitiva é na transação)
    if (existing.status !== 'RASCUNHO') {
      return NextResponse.json({ error: MSG_TRAVADA }, { status: 409 })
    }

    const body = await request.json()
    const { producerId, dataEntrega, observacoes, employeeId, employee2Id, itens } = body

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

    // ♻️ Recalcula com os preços VIGENTES (comportamento intencional).
    const calc = await calcularItensPaa(prisma, itens, { exigirAtivo: false })
    if ('error' in calc) {
      return NextResponse.json({ error: calc.error }, { status: 400 })
    }

    const entrega = await prisma.$transaction(async (tx) => {
      // 🛡️ Checagem definitiva dentro da transação (corrida com /assinar)
      const atual = await tx.entregaPaa.findUnique({ where: { id }, select: { status: true } })
      if (!atual) throw new HttpError(404, 'Entrega não encontrada')
      if (atual.status !== 'RASCUNHO') throw new HttpError(409, MSG_TRAVADA)

      await tx.entregaPaaItem.deleteMany({ where: { entregaPaaId: id } })
      return tx.entregaPaa.update({
        where: { id },
        data: {
          producerId,
          dataEntrega: dataEntrega ? new Date(dataEntrega + 'T12:00:00') : undefined,
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { assinaturaData, assinaturaHash, ...semAssinatura } = entrega
    return NextResponse.json(serializeEntregaPaa(semAssinatura as any))
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
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

    // 🔏 G1-8c — exclusão atômica condicionada ao RASCUNHO
    const del = await prisma.entregaPaa.deleteMany({ where: { id, status: 'RASCUNHO' } })
    if (del.count === 0) {
      return NextResponse.json({ error: MSG_TRAVADA }, { status: 409 })
    }

    return NextResponse.json({ message: 'Entrega excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE entrega PAA:', error)
    return NextResponse.json({ error: 'Erro ao excluir entrega' }, { status: 500 })
  }
}
