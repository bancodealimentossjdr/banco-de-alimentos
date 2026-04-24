import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { maskNotesListIfReadOnly } from '@/lib/mask-by-role'

export async function GET() {
  const authResult = await requireView('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const distributions = await prisma.distribution.findMany({
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })

    // 🔐 Mascara notes para quem é só leitura no módulo
    const session = await auth()
    const distributionsSeguras = maskNotesListIfReadOnly(distributions, session?.user?.role, 'distribuicoes')

    return NextResponse.json(distributionsSeguras)
  } catch (error) {
    console.error('Erro GET distribuições:', error)
    return NextResponse.json({ error: 'Erro ao buscar distribuições' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // 🔐 Só admin/operador podem criar distribuições
  const authResult = await requireEdit('distribuicoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    const dateValue = new Date(body.date + 'T12:00:00')

    const distribution = await prisma.distribution.create({
      data: {
        beneficiaryId: body.beneficiaryId,
        employeeId: body.employeeId || null,
        date: dateValue,
        notes: body.notes || null,
        items: {
          create: body.items.map((item: { productId: string; quantity: number }) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: {
        beneficiary: { select: { id: true, name: true, type: true } },
        employee: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
    })

    return NextResponse.json(distribution, { status: 201 })
  } catch (error) {
    console.error('Erro POST distribuição:', error)
    return NextResponse.json({ error: 'Erro ao criar distribuição' }, { status: 500 })
  }
}
