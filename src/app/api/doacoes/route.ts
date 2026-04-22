import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { maskNotesListIfReadOnly } from '@/lib/mask-by-role'

export async function GET() {
  const authResult = await requireView('doacoes')
  if (authResult instanceof NextResponse) return authResult

  try {
    const donations = await prisma.donation.findMany({
      include: {
        donor: { select: { id: true, name: true } },
        employee: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { date: 'desc' },
    })

    // 🔐 Mascara notes para quem é só leitura no módulo
    const session = await auth()
    const donationsSeguras = maskNotesListIfReadOnly(donations, session?.user?.role, 'doacoes')

    return NextResponse.json(donationsSeguras)
  } catch (error) {
    console.error('Erro GET doações:', error)
    return NextResponse.json({ error: 'Erro ao buscar doações' }, { status: 500 })
  }
}

// POST continua igual, não precisa mexer
