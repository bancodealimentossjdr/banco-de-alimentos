import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { calculateStock } from '@/lib/stock/calculate-stock'

export const dynamic = 'force-dynamic'

/**
 * GET /api/estoque/resumo
 *
 * 📐 Modelo do Reservatório com MARCO ZERO (Onda 16.2):
 *
 *   inStock = baseMarker.quantityKg
 *           + Σ DailyApproval.approvedQty       (após o marco)
 *           + Σ HarvestItem.quantity            (após o marco, status = "realizada")
 *           − Σ DistributionItem.quantity       (após o marco)
 *
 * 🧩 Regras:
 *   - Doações entram no estoque APENAS após triagem (DailyApproval)
 *   - Colheita Solidária é aproveitada integralmente → entra direto
 *   - Apenas colheitas com status "realizada" contam
 *
 * 🚦 Sem marco cadastrado:
 *   hasMarker: false → UI deve orientar o admin a criar o Marco Zero.
 *   Fallback legado mantém UI atual funcionando.
 *
 * 🔐 Acesso: usuários com permissão de visualização em 'estoque'.
 */
export async function GET() {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    // 📊 Snapshot do marco
    const snapshot = await calculateStock()

    // 📈 Totais globais (histórico completo, informativos)
    const [donationAgg, harvestAgg, distributionAgg, approvalAgg] =
      await Promise.all([
        prisma.donationItem.aggregate({ _sum: { quantity: true } }),
        // ℹ️ Total global de colheita: apenas REALIZADAS
        prisma.harvestItem.aggregate({
          _sum: { quantity: true },
          where: { harvest: { status: 'realizada' } },
        }),
        prisma.distributionItem.aggregate({ _sum: { quantity: true } }),
        prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
      ])

    const donations = donationAgg._sum.quantity ?? 0
    const solidarityHarvest = harvestAgg._sum.quantity ?? 0
    const distributed = distributionAgg._sum.quantity ?? 0
    const approved = approvalAgg._sum.approvedQty ?? 0

    // 📈 Taxa de aproveitamento das doações (%)
    // Colheita NÃO entra aqui — é 100% aproveitada por natureza
    const utilizationRate =
      donations > 0 ? (approved / donations) * 100 : 0

    // 📦 Estoque exibido
    const inStock = snapshot.hasMarker
      ? snapshot.currentStockKg
      : approved + solidarityHarvest - distributed // fallback legado

    return NextResponse.json({
      // 🆕 Marco Zero
      hasMarker: snapshot.hasMarker,
      baseMarker: snapshot.baseMarker,
      currentStockKg: snapshot.currentStockKg,
      movementsSinceMarker: snapshot.movements,
      infoSinceMarker: snapshot.info,
      calculatedAt: snapshot.calculatedAt,

      // 📊 Totais globais (histórico)
      donations,
      solidarityHarvest,
      approved,
      distributed,

      // 📦 Estoque atual (chave consumida pela UI atual)
      inStock,

      // 🧩 Breakdown
      inStockBreakdown: snapshot.hasMarker
        ? {
            baseMarkerKg: snapshot.baseMarker?.quantityKg ?? 0,
            approvedSinceMarker: snapshot.movements.approvedKg,
            harvestSinceMarker: snapshot.movements.harvestKg,
            distributedSinceMarker: snapshot.movements.distributedKg,
          }
        : {
            approved,
            solidarityHarvest,
            distributed,
          },

      utilizationRate: Number(utilizationRate.toFixed(1)),

      // 🐛 Debug
      debug: {
        mode: snapshot.hasMarker ? 'marker-based' : 'legacy-fallback',
        formula: snapshot.hasMarker
          ? 'inStock = baseMarker + approvedSince + harvestSince − distributedSince'
          : 'inStock = totalApproved + totalHarvestRealized − totalDistributed (legacy)',
        harvestStatusFilter: 'realizada',
        ...(snapshot.hasMarker &&
          snapshot.currentStockKg < 0 && {
            warning:
              '⚠️ Estoque negativo: saídas desde o marco > entradas. Verificar dados ou criar nova recalibração (ADJUSTMENT).',
          }),
        ...(!snapshot.hasMarker && {
          warning:
            '⚠️ Nenhum Marco Zero cadastrado. Saldo calculado pelo modelo legado. Crie o Marco Zero para calibrar o estoque oficialmente.',
        }),
      },
    })
  } catch (error) {
    console.error('[/api/estoque/resumo] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular resumo do estoque' },
      { status: 500 },
    )
  }
}
