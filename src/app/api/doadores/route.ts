import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireView('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const donors = await prisma.donor.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { donations: true } },
      },
    })
    return NextResponse.json(donors)
  } catch (error) {
    console.error('Erro GET doadores:', error)
    return NextResponse.json({ error: 'Erro ao buscar doadores' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const donor = await prisma.donor.create({
      data: {
        name: body.name,
        type: body.type,
        category: body.category,
        contact: body.contact || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
      },
    })
    return NextResponse.json(donor, { status: 201 })
  } catch (error) {
    console.error('Erro POST doador:', error)
    return NextResponse.json({ error: 'Erro ao criar doador' }, { status: 500 })
  }
}
