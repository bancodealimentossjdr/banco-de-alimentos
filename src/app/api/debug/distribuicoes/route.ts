import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.distributionItem.findMany({
      include: {
        distribution: {
          select: { id: true, date: true, beneficiaryId: true },
        },
      },
      orderBy: { id: "desc" },
    });

    const total = items.reduce((sum, i) => sum + i.quantity, 0);

    return NextResponse.json({
      count: items.length,
      totalKg: total,
      records: items.map((i) => ({
        itemId: i.id,
        distributionId: i.distributionId,
        date: i.distribution?.date?.toISOString().split("T")[0],
        beneficiaryId: i.distribution?.beneficiaryId,
        quantity: i.quantity,
      })),
    });
  } catch (error) {
    console.error("[/api/debug/distribuicoes] Erro:", error);
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
