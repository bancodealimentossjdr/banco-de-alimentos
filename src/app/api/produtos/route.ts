import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'

// Nome do produto que deve sempre aparecer primeiro nas listagens
const PRIORITY_PRODUCT = 'hortifruti'

export async function GET() {
  const authResult = await requireView('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    })

    // Ordena com Hortifruti no topo, depois alfabético
    const sorted = products.sort((a, b) => {
      const aIsPriority = a.name.trim().toLowerCase() === PRIORITY_PRODUCT
      const bIsPriority = b.name.trim().toLowerCase() === PRIORITY_PRODUCT
      if (aIsPriority && !bIsPriority) return -1
      if (!aIsPriority && bIsPriority) return 1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    return NextResponse.json(sorted)
  } catch (error) {
    console.error('Erro GET produtos:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const product = await prisma.product.create({
      data: {
        name: body.name,
        category: body.category,
        unit: body.unit,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Erro POST produto:', error)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
