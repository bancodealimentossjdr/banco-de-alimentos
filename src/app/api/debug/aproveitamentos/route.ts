import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * 🐛 GET /api/debug/aproveitamentos
 * Lista todos os registros de DailyApproval pra conferência manual.
 * ⚠️ Rota de debug — remover ou proteger em produção.
 */
export async function GET() {
  try {
    const approvals = await prisma.dailyApproval.findMany({
      orderBy: { date: "desc" },
    });

    const total = approvals.reduce((sum, a) => sum + a.approvedQty, 0);

    return NextResponse.json({
      count: approvals.length,
      totalKg: total,
      records: approvals.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split("T")[0],
        approvedQty: a.approvedQty,
        notes: a.notes,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[/api/debug/aproveitamentos] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao buscar aproveitamentos" },
      { status: 500 }
    );
  }
}
