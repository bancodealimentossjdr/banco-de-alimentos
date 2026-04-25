import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { startOfDay, endOfDay, parseISO } from 'date-fns'

export async function GET(req: NextRequest) {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)
    const dateParam = searchParams.get('date')

    if (!dateParam) {
      return NextResponse.json(
        { error: "Parâmetro 'date' é obrigatório (formato YYYY-MM-DD)" },
        { status: 400 },
      )
    }

    const date = parseISO(dateParam)
    const dayStart = startOfDay(date)
    const dayEnd = endOfDay(date)

    // 🏪 Buscar doações do dia (com itens e doador)
    const donations = await prisma.donation.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
      },
      include: {
        donor: { select: { id: true, name: true } },
        items: { select: { quantity: true } },
      },
      orderBy: { date: 'asc' },
    })

    // 🌾 Buscar colheita solidária do dia (com itens)
    const harvests = await prisma.solidarityHarvest.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
      },
      include: {
        items: { select: { quantity: true } },
      },
    })

    // ✅ Verificar se já existe aproveitamento registrado
    const existingApproval = await prisma.dailyApproval.findUnique({
      where: { date: dayStart },
    })

    // 📊 Agrupar doações por doador (somando quantidades dos itens)
    const donationsByDonor: Record<
      string,
      { donorId: string; donorName: string; quantity: number }
    > = {}

    for (const d of donations) {
      const totalQty = d.items.reduce((sum, item) => sum + item.quantity, 0)
      const key = d.donor.id

      if (!donationsByDonor[key]) {
        donationsByDonor[key] = {
          donorId: d.donor.id,
          donorName: d.donor.name,
          quantity: 0,
        }
      }
      donationsByDonor[key].quantity += totalQty
    }

    const donationsList = Object.values(donationsByDonor)
    const donationsTotal = donationsList.reduce((s, d) => s + d.quantity, 0)
    const harvestTotal = harvests.reduce(
      (sum, h) => sum + h.items.reduce((s, i) => s + i.quantity, 0),
      0,
    )

    return NextResponse.json({
      date: dateParam,
      donations: donationsList,
      donationsTotal,
      harvestTotal,
      totalReceived: donationsTotal, // base para o aproveitamento
      existingApproval: existingApproval || null,
    })
  } catch (error) {
    console.error('[APROVEITAMENTOS_PREVIEW]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar doações do dia' },
      { status: 500 },
    )
  }
}
