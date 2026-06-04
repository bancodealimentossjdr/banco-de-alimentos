import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { calculateUtilization } from '@/lib/stock/calculate-utilization'
import { calculateStock } from '@/lib/stock/calculate-stock'

export async function GET(req: NextRequest) {
  // 🛡️ Backend nunca confia no frontend: valida role no servidor.
  const auth = await requireView('estoque')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(req.url)
  const fromRaw = searchParams.get('from')
  const toRaw = searchParams.get('to')

  // ----------------------------------------------------------------
  // 📅 Período → afeta APENAS os FLUXOS:
  //    doado, distribuído, colheita, % aproveitamento, beneficiários.
  // ----------------------------------------------------------------
  const from = fromRaw ? new Date(fromRaw) : new Date('1970-01-01')
  const to = toRaw ? new Date(toRaw) : new Date()

  from.setHours(0, 0, 0, 0)
  to.setHours(23, 59, 59, 999)

  try {
    // ----------------------------------------------------------------
    // 🧮 Fonte ÚNICA das fórmulas (Onda 16.5).
    //    Sem filtros de entidade → utilization vem preenchido.
    //    OBS: o currentStockKg DESTE snapshot é ignorado de propósito
    //    (ele respeita o `to`; queremos saldo VIVO — ver abaixo).
    // ----------------------------------------------------------------
    const snapshot = await calculateUtilization({ from, to })
    const { volumes, utilization } = snapshot

    // ----------------------------------------------------------------
    // 📦 ESTOQUE = saldo VIVO. NÃO respeita o período da tela.
    //    Sempre até AGORA, a partir do último marco.
    //    ❌ ANTES: calculateStock(to)  → congelava no fim do período.
    //    ✅ AGORA: calculateStock()    → soma movimentações de hoje.
    // ----------------------------------------------------------------
    const stockNow = await calculateStock(new Date())
    const emEstoque = stockNow.hasMarker ? stockNow.currentStockKg : 0

    // ----------------------------------------------------------------
    // 👥 Beneficiários únicos atendidos no período.
    // ----------------------------------------------------------------
    const beneficiariosUnicos = await prisma.distribution.findMany({
      where: { date: { gte: from, lte: to } },
      select: { beneficiaryId: true },
      distinct: ['beneficiaryId'],
    })

    // ----------------------------------------------------------------
    // 📤 Resposta.
    // ----------------------------------------------------------------
    return NextResponse.json({
      // 🔁 Fluxos: respeitam o período selecionado.
      totalDoado: volumes.donationsKg,
      totalDistribuido: volumes.distributedKg,
      totalColheita: volumes.harvestKg,
      percentualAproveitamento: utilization.utilizationPct ?? 0,
      beneficiariosAtendidos: beneficiariosUnicos.length,

      // 📦 Estoque: saldo vivo, independente do período.
      emEstoque,

      calculatedAt: new Date(),
    })
  } catch (error) {
    console.error('[indicadores/macro] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular indicadores macro.' },
      { status: 500 },
    )
  }
}
