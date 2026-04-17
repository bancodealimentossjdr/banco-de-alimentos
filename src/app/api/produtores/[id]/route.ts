import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Buscar produtor por ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const produtor = await prisma.producer.findUnique({
      where: { id: params.id },
      include: {
        harvests: {
          include: { items: { include: { product: true } } },
          orderBy: { date: 'desc' },
        },
        _count: { select: { harvests: true } },
      },
    })

    if (!produtor) {
      return NextResponse.json({ error: 'Produtor não encontrado' }, { status: 404 })
    }

    return NextResponse.json(produtor)
  } catch (error) {
    console.error('Erro ao buscar produtor:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtor' }, { status: 500 })
  }
}

// PUT - Atualizar produtor
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { name, phone, address, property, active } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const produtor = await prisma.producer.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        phone: phone || null,
        address: address || null,
        property: property || null,
        active: active !== undefined ? active : true,
      },
      include: {
        _count: { select: { harvests: true } },
      },
    })

    return NextResponse.json(produtor)
  } catch (error) {
    console.error('Erro ao atualizar produtor:', error)
    return NextResponse.json({ error: 'Erro ao atualizar produtor' }, { status: 500 })
  }
}

// DELETE - Excluir produtor
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const produtor = await prisma.producer.findUnique({
      where: { id: params.id },
      include: { _count: { select: { harvests: true } } },
    })

    if (!produtor) {
      return NextResponse.json({ error: 'Produtor não encontrado' }, { status: 404 })
    }

    if (produtor._count.harvests > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Este produtor possui ${produtor._count.harvests} colheita(s) vinculada(s).` },
        { status: 400 }
      )
    }

    await prisma.producer.delete({ where: { id: params.id } })
    return NextResponse.json({ message: 'Produtor excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir produtor:', error)
    return NextResponse.json({ error: 'Erro ao excluir produtor' }, { status: 500 })
  }
}
