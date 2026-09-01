import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { buildPaaData, checkCodigoColisao } from '@/lib/paa'

// Nome do produto que deve sempre aparecer primeiro nas listagens
const PRIORITY_PRODUCT = 'hortifruti'

export async function GET(request: NextRequest) {
  const authResult = await requireView('produtos')
  if (authResult instanceof NextResponse) return authResult

  const sp = request.nextUrl.searchParams
  const onlyActive = sp.get('active') === 'true'
  const paaFilter = sp.get('paa') // 'true' | 'false' | null

  try {
    const where: any = {}
    if (onlyActive) where.active = true
    if (paaFilter === 'true') where.isPaa = true
    if (paaFilter === 'false') where.isPaa = false

    const products = await prisma.product.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { name: 'asc' },
    })

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

    if (!body.name?.trim() || !body.category || !body.unit) {
      return NextResponse.json({ error: 'Nome, categoria e unidade são obrigatórios.' }, { status: 400 })
    }

    const paa = buildPaaData(body)
    if ('error' in paa) return NextResponse.json({ error: paa.error }, { status: 400 })

    const colisao = await checkCodigoColisao(prisma, paa.data)
    if (colisao) return NextResponse.json({ error: colisao }, { status: 409 })

    const product = await prisma.product.create({
      data: {
        name: body.name.trim(),
        category: body.category,
        unit: body.unit,
        minStock: Number(body.minStock) || 0,
        ...paa.data,
      },
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Erro POST produto:', error)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
