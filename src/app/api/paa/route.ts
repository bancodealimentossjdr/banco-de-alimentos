import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { calcularItensPaa, serializeEntregaPaa } from '@/lib/paa-calc'
import {
  maskEntregaPaaList,
  maskProdutor,
  maskFuncionario,
  maskNotesListIfReadOnly,
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

export async function GET(request: NextRequest) {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(request.url)
    const producerId = searchParams.get('producerId') || undefined
    const de = searchParams.get('de')
    const ate = searchParams.get('ate')

    const entregas = await prisma.entregaPaa.findMany({
      where: {
        producerId,
        dataEntrega: de || ate
          ? {
              ...(de ? { gte: new Date(de + 'T00:00:00') } : {}),
              ...(ate ? { lte: new Date(ate + 'T23:59:59') } : {}),
            }
          : undefined,
      },
      orderBy: [{ dataEntrega: 'desc' }, { createdAt: 'desc' }],
      include: INCLUDE,
    })

    const session = await auth()
    const role = session?.user?.role

    let seguras: any[] = entregas.map(serializeEntregaPaa)

    // `observacoes` é texto livre → trata como `notes` nos demais módulos
    seguras = maskNotesListIfReadOnly(
      seguras.map((e) => ({ ...e, notes: e.observacoes })),
      role,
      'paa'
    ).map(({ notes, ...e }: any) => ({ ...e, observacoes: notes }))

    // 🔴 Valores financeiros individualizados
    seguras = maskEntregaPaaList(seguras, role)

    // 🎭 Dados pessoais
    if (shouldMaskPersonalData(role)) {
      seguras = seguras.map((e) => ({
        ...e,
        numeroNota: e.numeroNota ? '***' : null,
        producer: e.producer ? maskProdutor(e.producer, role) : e.producer,
        employee: e.employee ? maskFuncionario(e.employee, role) : e.employee,
        employee2: e.employee2 ? maskFuncionario(e.employee2, role) : e.employee2,
      }))
    }

    return NextResponse.json(seguras)
  } catch (error) {
    console.error('Erro GET entregas PAA:', error)
    return NextResponse.json({ error: 'Erro ao buscar entregas do PAA' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireEdit('paa')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const { producerId, dataEntrega, numeroNota, observacoes, employeeId, employee2Id, itens } = body

    if (!producerId) {
      return NextResponse.json({ error: 'Produtor é obrigatório' }, { status: 400 })
    }
    if (!dataEntrega) {
      return NextResponse.json({ error: 'Data da entrega é obrigatória' }, { status: 400 })
    }
    if (employeeId && employee2Id && employeeId === employee2Id) {
      return NextResponse.json(
        { error: 'Não é possível selecionar o mesmo funcionário duas vezes' },
        { status: 400 }
      )
    }

    // 🛡️ Produtor precisa existir, estar ativo e atender o PAA
    const producer = await prisma.producer.findUnique({
      where: { id: producerId },
      select: { id: true, name: true, active: true, atendePaa: true },
    })
    if (!producer) {
      return NextResponse.json({ error: 'Produtor não encontrado' }, { status: 400 })
    }
    if (!producer.active) {
      return NextResponse.json(
        { error: `"${producer.name}" está inativo e não pode receber novos lançamentos.` },
        { status: 400 }
      )
    }
    if (!producer.atendePaa) {
      return NextResponse.json(
        { error: `"${producer.name}" não está marcado como fornecedor do PAA.` },
        { status: 400 }
      )
    }

    // 🔒 Cálculo 100% server-side
    const calc = await calcularItensPaa(prisma, itens, { exigirAtivo: true })
    if ('error' in calc) {
      return NextResponse.json({ error: calc.error }, { status: 400 })
    }

    const entrega = await prisma.$transaction(async (tx) => {
      return tx.entregaPaa.create({
        data: {
          producerId,
          dataEntrega: new Date(dataEntrega + 'T12:00:00'),
          numeroNota: numeroNota?.trim() || null,
          observacoes: observacoes?.trim() || null,
          employeeId: employeeId || null,
          employee2Id: employee2Id || null,
          valorTotal: calc.valorTotal,
          pesoTotalKg: calc.pesoTotalKg,
          createdById: authResult.user.id,
          itens: { create: calc.itens },
        },
        include: INCLUDE,
      })
    })

    return NextResponse.json(serializeEntregaPaa(entrega), { status: 201 })
  } catch (error) {
    console.error('Erro POST entrega PAA:', error)
    return NextResponse.json({ error: 'Erro ao registrar entrega do PAA' }, { status: 500 })
  }
}
