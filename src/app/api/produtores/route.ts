import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { maskProdutorList } from '@/lib/mask-by-role'

// GET - Listar todos os produtores
export async function GET() {
  const authResult = await requireView('produtores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const session = await auth()
    const role = session?.user?.role

    const produtores = await prisma.producer.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { harvests: true } },
      },
    })

    const masked = maskProdutorList(produtores, role)
    return NextResponse.json(masked)
  } catch (error) {
    console.error('Erro ao buscar produtores:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtores' }, { status: 500 })
  }
}

// POST - Criar novo produtor
export async function POST(request: NextRequest) {
  const authResult = await requireEdit('produtores')
  if (authResult instanceof NextResponse) return authResult

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
