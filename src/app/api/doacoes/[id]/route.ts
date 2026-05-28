import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireView,
  requireEditRecord,
  requireDeleteRecord,
} from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import {
  maskNotesIfReadOnly,
  maskDoador,
  maskFuncionario,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

// GET - Buscar doação por ID
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
        donor: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: { include: { product: true } },
      },
    })

    if (!donation) {
      return NextResponse.json(
        { error: 'Doação não encontrada' },
        { status: 404 }
      )
    }

    // 🔐 Aplica máscaras conforme o role
    const session = await auth()
    const role = session?.user?.role

    // 1) Mascara notes se for somente leitura no módulo
    let donationSegura = maskNotesIfReadOnly(donation, role, 'doacoes')

    // 2) Mascara dados pessoais se for visualizador
    if (shouldMaskPersonalData(role)) {
      donationSegura = {
        ...donationSegura,
        donor: donationSegura.donor
          ? maskDoador(donationSegura.donor, role)
          : donationSegura.donor,
        employee: donationSegura.employee
          ? maskFuncionario(donationSegura.employee, role)
          : donationSegura.employee,
        employee2: donationSegura.employee2
          ? maskFuncionario(donationSegura.employee2, role)
          : donationSegura.employee2,
        employee3: donationSegura.employee3
          ? maskFuncionario(donationSegura.employee3, role)
          : donationSegura.employee3,
      }
    }

    return NextResponse.json(donationSegura)
  } catch (error) {
    console.error('Erro ao buscar doação:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar doação' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar doação
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 🔒 Busca o registro ANTES pra checar trava temporal
    const existing = await prisma.donation.findUnique({
      where: { id },
      select: { date: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Doação não encontrada' },
        { status: 404 }
      )
    }

    // 🔐 Auth + permissão básica + trava temporal (operador só edita doações de hoje)
    const authResult = await requireEditRecord('doacoes', existing.date)
    if (authResult instanceof NextResponse) return authResult

    const body = await request.json()
    const {
      donorId,
      employeeId,
      employee2Id,
      employee3Id,
      date,
      origin,
      notes,
      items,
    } = body

    // Validações
    if (!donorId) {
      return NextResponse.json(
        { error: 'Doador é obrigatório' },
        { status: 400 }
      )
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Funcionário responsável é obrigatório' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um item à doação' },
        { status: 400 }
      )
    }

    // 🔍 Validação: funcionários não podem se repetir
    const employeeIds = [employeeId, employee2Id, employee3Id].filter(Boolean)
    const uniqueIds = new Set(employeeIds)
    if (uniqueIds.size !== employeeIds.length) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo funcionário mais de uma vez' },
        { status: 400 }
      )
    }

    // Deleta itens antigos e cria novos (jeito mais simples e seguro)
    await prisma.donationItem.deleteMany({
      where: { donationId: id },
    })

    const donation = await prisma.donation.update({
      where: { id },
      data: {
        donorId,
        employeeId,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
        date: date ? new Date(date) : undefined,
        origin: origin || 'coleta',
        notes: notes || null,
        items: {
          create: items.map(
            (item: {
              productId: string
              quantity: number | string
              boxes?: number | string
              weighed?: boolean
            }) => ({
              productId: item.productId,
              quantity: parseFloat(String(item.quantity)),
              boxes: item.boxes ? parseInt(String(item.boxes)) : null,
              weighed: item.weighed || false,
            })
          ),
        },
      },
      include: {
        donor: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: { include: { product: true } },
      },
    })

    return NextResponse.json(donation)
  } catch (error) {
    console.error('Erro ao atualizar doação:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar doação' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir doação (APENAS ADMIN)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 🔒 Confirma que o registro existe (pra retornar 404 correto)
    const existing = await prisma.donation.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Doação não encontrada' },
        { status: 404 }
      )
    }

    // 🚫 Apenas admin pode excluir. Operador é bloqueado.
    const authResult = await requireDeleteRecord('doacoes')
    if (authResult instanceof NextResponse) return authResult

    await prisma.donation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir doação:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir doação' },
      { status: 500 }
    )
  }
}
