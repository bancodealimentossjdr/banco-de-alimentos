import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const beneficiaries = await prisma.beneficiary.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { distributions: true } },
      },
    })
    return NextResponse.json(beneficiaries)
  } catch (error) {
    console.error('Erro GET beneficiários:', error)
    return NextResponse.json({ error: 'Erro ao buscar instituições' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const beneficiary = await prisma.beneficiary.create({
      data: {
        name: body.name,
        type: body.type,
        address: body.address || null,
        phone: body.phone || null,
        contact: body.contact || null,
        status: body.status || 'ativo',
        notes: body.notes || null,
      },
    })
    return NextResponse.json(beneficiary, { status: 201 })
  } catch (error) {
    console.error('Erro POST beneficiário:', error)
    return NextResponse.json({ error: 'Erro ao criar instituição' }, { status: 500 })
  }
}