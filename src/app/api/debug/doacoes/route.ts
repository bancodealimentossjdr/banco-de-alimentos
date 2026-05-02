import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.donationItem.findMany({
      include: {
        donation: {
          select: { id: true, date: true, donorId: true },
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
        donationId: i.donationId,
        date: i.donation?.date?.toISOString().split("T")[0],
        donorId: i.donation?.donorId,
        quantity: i.quantity,
      })),
    });
  } catch (error) {
    console.error("[/api/debug/doacoes] Erro:", error);
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
