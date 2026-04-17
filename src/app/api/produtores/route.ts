import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Listar todos os produtores
export async function GET() {
  try {
    const produtores = await prisma.producer.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { harvests: true } },
      },
    })
    return NextResponse.json(produtores)
  } catch (error) {
    console.error('Erro ao buscar produtores:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtores' }, { status: 500 })
  }
}

// POST - Criar novo produtor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, address, property } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const produtor = await prisma.producer.create({
      data: {
        name: name.trim(),
        phone: phone || null,
        address: address || null,
        property: property || null,
      },
      include: {
        _count: { select: { harvests: true } },
      },
    })

    return NextResponse.json(produtor, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produtor:', error)
    return NextResponse.json({ error: 'Erro ao criar produtor' }, { status: 500 })
  }
}
