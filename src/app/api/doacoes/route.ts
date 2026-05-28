import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import {
  maskNotesListIfReadOnly,
  maskDoador,
  maskFuncionario,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

// GET - Listar todas as doações
export async function GET() {
  // 🔐 Autenticação + permissão de visualização
  const authResult = await requireView('doacoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const donations = await prisma.donation.findMany({
      include: {
        donor: true,
        employee: true,
        employee2: true,
        employee3: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    // 🔐 Aplica máscaras conforme o role
    const session = await auth()
    const role = session?.user?.role

    // 1) Mascara notes se for somente leitura no módulo
    let donationsSeguras = maskNotesListIfReadOnly(donations, role, 'doacoes')

    // 2) Mascara dados pessoais do doador e funcionários se for visualizador
    if (shouldMaskPersonalData(role)) {
      donationsSeguras = donationsSeguras.map((d) => ({
        ...d,
        donor: d.donor ? maskDoador(d.donor, role) : d.donor,
        employee: d.employee ? maskFuncionario(d.employee, role) : d.employee,
        employee2: d.employee2 ? maskFuncionario(d.employee2, role) : d.employee2,
        employee3: d.employee3 ? maskFuncionario(d.employee3, role) : d.employee3,
      }))
    }

    return NextResponse.json(donationsSeguras)
  } catch (error) {
    console.error('Erro ao buscar doações:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar doações' },
      { status: 500 }
    )
  }
}

// POST - Criar nova doação
export async function POST(request: NextRequest) {
  // 🔐 Só admin/operador podem criar doações
  const authResult = await requireEdit('doacoes')
  if (authResult instanceof NextResponse) return authResult

  try {
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

    // Validações básicas
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

    const donation = await prisma.donation.create({
      data: {
        donorId,
        employeeId,
        employee2Id: employee2Id || null,
        employee3Id: employee3Id || null,
        date: date ? new Date(date) : new Date(),
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
        items: {
          include: { product: true },
        },
      },
    })

    return NextResponse.json(donation, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar doação:', error)
    return NextResponse.json(
      { error: 'Erro ao criar doação' },
      { status: 500 }
    )
  }
}
