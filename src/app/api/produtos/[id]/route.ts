import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEdit } from '@/lib/auth-helpers'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const body = await request.json()

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name,
        category: body.category,
        unit: body.unit,
        minStock: body.minStock || 0,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT produto:', error)
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            donationItems: true,
            distributionItems: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const total = product._count.donationItems + product._count.distributionItems
    if (total > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir: este produto possui ${product._count.donationItems} doação(ões) e ${product._count.distributionItems} distribuição(ões) vinculada(s).` },
        { status: 400 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ message: 'Produto excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE produto:', error)
    return NextResponse.json({ error: 'Erro ao excluir produto' }, { status: 500 })
  }
}
