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
        beneficiary: { select: { id: true, name: true } },
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

// POST continua igual, não precisa mexer
