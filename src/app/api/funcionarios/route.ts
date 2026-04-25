import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'

export async function GET() {
  const authResult = await requireView('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            donationsAsEmployee1: true,
            donationsAsEmployee2: true,
            donationsAsEmployee3: true,
            distributionsAsEmployee1: true,
            distributionsAsEmployee2: true,
            distributionsAsEmployee3: true,
            harvestsAsEmployee1: true,
            harvestsAsEmployee2: true,
            harvestsAsEmployee3: true,
          },
        },
      },
    })
    return NextResponse.json(employees)
  } catch (error) {
    console.error('Erro GET funcionários:', error)
    return NextResponse.json({ error: 'Erro ao buscar funcionários' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('funcionarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()
    const employee = await prisma.employee.create({
      data: {
        name: body.name,
        role: body.role || null,
        phone: body.phone || null,
      },
    })
    return NextResponse.json(employee, { status: 201 })
  } catch (error) {
    console.error('Erro POST funcionário:', error)
    return NextResponse.json({ error: 'Erro ao criar funcionário' }, { status: 500 })
  }
}
