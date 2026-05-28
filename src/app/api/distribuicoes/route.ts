import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import {
  maskNotesListIfReadOnly,
  maskBeneficiario,
  maskFuncionario,
  shouldMaskPersonalData,
} from '@/lib/mask-by-role'

export async function GET() {
  const authResult = await requireView('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const distributions = await prisma.distribution.findMany({
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        employee2: { select: { id: true, name: true } },
        employee3: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })

    // 🔐 Aplica máscaras conforme o role
    const session = await auth()
    const role = session?.user?.role

    // 1) Mascara notes se for somente leitura no módulo
    let distributionsSeguras = maskNotesListIfReadOnly(
      distributions,
      role,
      'distribuicoes'
    )

    // 2) Mascara dados pessoais do beneficiário e funcionários se for visualizador
    if (shouldMaskPersonalData(role)) {
      distributionsSeguras = distributionsSeguras.map((d) => ({
        ...d,
        beneficiary: d.beneficiary
          ? maskBeneficiario(d.beneficiary, role)
          : d.beneficiary,
        employee: d.employee ? maskFuncionario(d.employee, role) : d.employee,
        employee2: d.employee2
          ? maskFuncionario(d.employee2, role)
          : d.employee2,
        employee3: d.employee3
          ? maskFuncionario(d.employee3, role)
          : d.employee3,
      }))
    }

    return NextResponse.json(distributionsSeguras)
  } catch (error) {
    console.error('Erro GET distribuições:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar distribuições' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  // 🔐 Só admin/operador podem criar distribuições
  const authResult = await requireEdit('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    // 🔍 Validação: funcionários não podem se repetir
    const empIds = [body.employeeId, body.employee2Id, body.employee3Id].filter(
      Boolean
    )
    if (empIds.length !== new Set(empIds).size) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo funcionário mais de uma vez' },
        { status: 400 }
      )
    }

    const dateValue = new Date(body.date + 'T12:00:00')

    const distribution = await prisma.distribution.create({
      data: {
        beneficiaryId: body.beneficiaryId,
        employeeId: body.employeeId || null,
        employee2Id: body.employee2Id || null,
        employee3Id: body.employee3Id || null,
        date: dateValue,
        notes: body.notes || null,
        items: {
          create: body.items.map(
            (item: { productId: string; quantity: number; boxes?: number }) => ({
              productId: item.productId,
              quantity: item.quantity,
              boxes: item.boxes ?? null,
            })
          ),
        },
      },
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        employee2: { select: { id: true, name: true } },
        employee3: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
    })

    return NextResponse.json(distribution, { status: 201 })
  } catch (error) {
    console.error('Erro POST distribuição:', error)
    return NextResponse.json(
      { error: 'Erro ao criar distribuição' },
      { status: 500 }
    )
  }
}
