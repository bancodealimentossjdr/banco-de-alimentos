import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/estoque/resumo
 *
 * Retorna o resumo consolidado do estoque do Banco de Alimentos.
 *
 * 📐 Fórmulas (alinhadas ao processo real da operação):
 *
 *   🏪 Doações Brutas    = Σ DonationItem.quantity
 *   🌾 Colheita Solidária = Σ HarvestItem.quantity
 *   📤 Distribuído        = Σ DistributionItem.quantity
 *   🧊 Câmara Fria        = Σ DailyApproval.approvedQty (sobra triada do dia)
 *
 *   ✅ Aproveitado TOTAL = Distribuído + Câmara Fria
 *      (ambos são alimento bom: ou já saiu pra beneficiário, ou foi guardado)
 *
 *   📦 Em Estoque (físico AGORA) =
 *        Câmara Fria + Colheita − max(0, Distribuído − Doações Brutas)
 *
 *      O termo max(0, Distribuído − Doações) representa quanto da câmara fria
 *      foi consumido pelas distribuições (só desconta quando se distribuiu
 *      MAIS do que chegou em doações brutas).
 *
 *   📈 Taxa de Aproveitamento = Aproveitado / (Doações + Colheita) × 100%
 */
export async function GET() {
  try {
    // 🔢 Agregações em paralelo pra performance
    const [
      donationAgg,
      harvestAgg,
      distributionAgg,
      approvalAgg,
    ] = await Promise.all([
      prisma.donationItem.aggregate({
        _sum: { quantity: true },
      }),
      prisma.harvestItem.aggregate({
        _sum: { quantity: true },
      }),
      prisma.distributionItem.aggregate({
        _sum: { quantity: true },
      }),
      prisma.dailyApproval.aggregate({
        _sum: { approvedQty: true },
      }),
    ]);

    // 📊 Totais brutos
    const totalDonations = donationAgg._sum.quantity ?? 0;
    const totalHarvest = harvestAgg._sum.quantity ?? 0;
    const totalDistributed = distributionAgg._sum.quantity ?? 0;
    const totalColdRoom = approvalAgg._sum.approvedQty ?? 0;

    // ✅ Aproveitado = Distribuído + Câmara Fria
    const totalApproved = totalDistributed + totalColdRoom;

    // 📦 Em Estoque = Câmara Fria + Colheita − consumo do estoque
    const stockConsumption = Math.max(0, totalDistributed - totalDonations);
    const inStock = totalColdRoom + totalHarvest - stockConsumption;

    // 📈 Taxa de aproveitamento (%)
    const totalReceived = totalDonations + totalHarvest;
    const utilizationRate =
      totalReceived > 0 ? (totalApproved / totalReceived) * 100 : 0;

    return NextResponse.json({
      // Totais principais
      donations: totalDonations,
      harvest: totalHarvest,
      distributed: totalDistributed,
      approved: totalApproved,
      inStock,

      // 🔍 Breakdown do aproveitado (pra UI mostrar "quebrado em 2 linhas")
      approvedBreakdown: {
        distributed: totalDistributed,
        coldRoom: totalColdRoom,
      },

      // 📈 Métrica adicional
      utilizationRate: Number(utilizationRate.toFixed(1)),

      // 🐛 Debug info (útil pra conferir cálculos)
      debug: {
        stockConsumption,
        formula:
          "inStock = coldRoom + harvest - max(0, distributed - donations)",
      },
    });
  } catch (error) {
    console.error("[/api/estoque/resumo] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao calcular resumo do estoque" },
      { status: 500 }
    );
  }
}
