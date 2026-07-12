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

// 🆕 ONDA 19 — 3 origens
type Origem = 'DOACAO' | 'COLHEITA' | 'EVENTO'
const ORIGENS_VALIDAS: Origem[] = ['DOACAO', 'COLHEITA', 'EVENTO']

// Normaliza origem por item; default seguro = DOACAO
const normOrigem = (o: unknown): Origem =>
  o === 'EVENTO' || o === 'COLHEITA' ? o : 'DOACAO'

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
        receipt: { select: { id: true } },
      },
      orderBy: { date: 'desc' },
    })

    const session = await auth()
    const role = session?.user?.role

    let distributionsSeguras = maskNotesListIfReadOnly(
      distributions,
      role,
      'distribuicoes',
    )

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
      })) as typeof distributionsSeguras
    }

    if (role === 'visualizador') {
      distributionsSeguras = distributionsSeguras.map((d) => {
        const { status, legacy, receipt, ...rest } = d
        void status
        void legacy
        void receipt
        return rest
      }) as typeof distributionsSeguras
    }

    return NextResponse.json(distributionsSeguras)
  } catch (error) {
    console.error('Erro GET distribuições:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar distribuições' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    const empIds = [body.employeeId, body.employee2Id, body.employee3Id].filter(
      Boolean,
    )
    if (empIds.length !== new Set(empIds).size) {
      return NextResponse.json(
        { error: 'Não é possível adicionar o mesmo funcionário mais de uma vez' },
        { status: 400 },
      )
    }

    // 🆕 ONDA 19 — origem por item (DOACAO | COLHEITA | EVENTO)
    type IncomingItem = {
      productId: string
      quantity: number
      boxes?: number
      origem?: Origem
    }
    const incomingItems: IncomingItem[] = Array.isArray(body.items)
      ? body.items
      : []

    if (incomingItems.length === 0) {
      return NextResponse.json(
        { error: 'Adicione pelo menos um produto' },
        { status: 400 },
      )
    }

    // Valida cada origem
    for (const it of incomingItems) {
      if (
        it.origem !== undefined &&
        !ORIGENS_VALIDAS.includes(it.origem as Origem)
      ) {
        return NextResponse.json(
          { error: 'Origem inválida. Use DOACAO, COLHEITA ou EVENTO.' },
          { status: 400 },
        )
      }
    }

    // origem legado (enum: só DOACAO|EVENTO). COLHEITA cai como DOACAO no legado.
    const primeira = normOrigem(incomingItems[0].origem)
    const origemLegado = primeira === 'EVENTO' ? 'EVENTO' : 'DOACAO'

    const dateValue = new Date(body.date + 'T12:00:00')

    const distribution = await prisma.distribution.create({
      data: {
        beneficiaryId: body.beneficiaryId,
        origem: origemLegado, // ⚠️ legado — cálculo real usa item.origem
        employeeId: body.employeeId || null,
        employee2Id: body.employee2Id || null,
        employee3Id: body.employee3Id || null,
        date: dateValue,
        notes: body.notes || null,
        items: {
          create: incomingItems.map((item) => ({
            product: { connect: { id: item.productId } },
            quantity: item.quantity,
            boxes: item.boxes ?? null,
            origem: normOrigem(item.origem),
          })),
        },
      }, // ✅ fecha o data (ESTAVA FALTANDO)
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        employee2: { select: { id: true, name: true } },
        employee3: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
        receipt: { select: { id: true } },
      },
    })

    return NextResponse.json(distribution, { status: 201 })
  } catch (error) {
    console.error('Erro POST distribuição:', error)
    return NextResponse.json(
      { error: 'Erro ao criar distribuição' },
      { status: 500 },
    )
  }
}
