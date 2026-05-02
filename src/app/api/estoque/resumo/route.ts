import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/estoque/resumo
 *
 * Retorna o resumo consolidado do estoque do Banco de Alimentos.
 *
 * 📐 Modelo (alinhado à operação real):
 *
 *   🏪 Doações           = Σ DonationItem.quantity         (bruto recebido de doadores)
 *   🌾 Colheita Solidária = Σ HarvestItem.quantity         (informativo, calculada à parte)
 *   📤 Distribuído        = Σ DistributionItem.quantity    (saiu pros beneficiários)
 *   🧊 Câmara Fria        = Σ DailyApproval.approvedQty    (físico guardado AGORA)
 *
 *   ✅ Aproveitado = Câmara Fria + Distribuído
 *      → todo alimento BOM que passou pela triagem das doações:
 *        parte ainda está guardada (câmara) + parte já saiu (distribuído)
 *
 *   📦 Em Estoque = Câmara Fria
 *      → literalmente o que está dentro da câmara agora.
 *      → Colheita NÃO entra aqui (é cadastrada à parte e não passa pela câmara fria).
 *
 *   📈 Taxa de Aproveitamento das Doações = Aproveitado / Doações × 100%
 */
export async function GET() {
  try {
    // 🔢 Agregações em paralelo
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
    const donations = donationAgg._sum.quantity ?? 0;
    const solidarityHarvest = harvestAgg._sum.quantity ?? 0;
    const distributed = distributionAgg._sum.quantity ?? 0;
    const coldRoom = approvalAgg._sum.approvedQty ?? 0;

    // ✅ Aproveitado = Câmara Fria + Distribuído
    const approved = coldRoom + distributed;

    // 📦 Em Estoque = Câmara Fria (físico guardado agora)
    const inStock = coldRoom;

    // 📈 Taxa de aproveitamento das doações (%)
    const utilizationRate =
      donations > 0 ? (approved / donations) * 100 : 0;

    return NextResponse.json({
      // Totais principais (chaves que a UI consome)
      donations,
      solidarityHarvest,
      approved,
      distributed,
      inStock,

      // 🔍 Breakdown opcional do aproveitado
      approvedBreakdown: {
        coldRoom,
        distributed,
      },

      // 📈 Métrica adicional
      utilizationRate: Number(utilizationRate.toFixed(1)),

      // 🐛 Debug (útil pra conferir cálculos)
      debug: {
        formula: {
          approved: "approved = coldRoom + distributed",
          inStock: "inStock = coldRoom",
        },
        raw: {
          donations,
          solidarityHarvest,
          distributed,
          coldRoom,
        },
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
