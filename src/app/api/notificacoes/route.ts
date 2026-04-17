import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface Notification {
  id: string
  type: 'estoque_zerado' | 'estoque_baixo' | 'sem_doacoes' | 'info'
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  productId?: string
}

export async function GET() {
  try {
    const notifications: Notification[] = []

    // Busca todos os produtos com dados de estoque
    const products = await prisma.product.findMany({
      include: {
        donationItems: { select: { quantity: true } },
        distributionItems: { select: { quantity: true } },
      },
    })

    for (const product of products) {
      const donated = product.donationItems.reduce((sum, i) => sum + i.quantity, 0)
      const distributed = product.distributionItems.reduce((sum, i) => sum + i.quantity, 0)
      const stock = donated - distributed

      if (stock <= 0) {
        notifications.push({
          id: `zerado-${product.id}`,
          type: 'estoque_zerado',
          severity: 'critical',
          title: 'Estoque zerado',
          message: `"${product.name}" está com estoque zerado (${stock.toFixed(1)} ${product.unit}).`,
          productId: product.id,
        })
      } else if (stock <= product.minStock) {
        notifications.push({
          id: `baixo-${product.id}`,
          type: 'estoque_baixo',
          severity: 'warning',
          title: 'Estoque baixo',
          message: `"${product.name}" está abaixo do mínimo: ${stock.toFixed(1)} ${product.unit} (mín: ${product.minStock} ${product.unit}).`,
          productId: product.id,
        })
      }
    }

    // Verifica se não houve doações nos últimos 7 dias
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentDonations = await prisma.donation.count({
      where: { date: { gte: sevenDaysAgo } },
    })

    if (recentDonations === 0 && products.length > 0) {
      notifications.push({
        id: 'sem-doacoes-recentes',
        type: 'sem_doacoes',
        severity: 'warning',
        title: 'Sem doações recentes',
        message: 'Nenhuma doação registrada nos últimos 7 dias.',
      })
    }

    // Ordena: critical primeiro, depois warning, depois info
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return NextResponse.json(notifications)
  } catch (error) {
    console.error('Erro GET notificações:', error)
    return NextResponse.json({ error: 'Erro ao buscar notificações' }, { status: 500 })
  }
}