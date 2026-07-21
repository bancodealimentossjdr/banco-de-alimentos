import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function soDigitos(v: string) {
  return (v || "").replace(/\D/g, "");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const cpfRaw = req.nextUrl.searchParams.get("cpf") ?? "";
  const cpf = soDigitos(cpfRaw);

  if (cpf.length !== 11) {
    return NextResponse.json(
      { encontrado: false, cpf, reservas: [] },
      { status: 200 }
    );
  }

  const reservas = await prisma.reservaIngresso.findMany({
    where: { cpf },
    orderBy: { createdAt: "asc" },
    include: {
      lote: {
        select: { showLabel: true, showData: true },
      },
      retiradoPor: {
        select: { name: true },
      },
    },
  });

  if (reservas.length === 0) {
    return NextResponse.json(
      { encontrado: false, cpf, reservas: [] },
      { status: 200 }
    );
  }

  const nome = reservas[0].nome;
  let totalDisponiveis = 0;
  let totalRetirados = 0;

  const reservasFmt = reservas.map((r) => {
    if (r.retirado) totalRetirados++;
    else totalDisponiveis++;

    return {
      id: r.id,
      protocolo: r.protocolo,
      showLabel: r.lote.showLabel,
      showData: r.lote.showData.toISOString(),
      retirado: r.retirado,
      retiradoEm: r.retiradoEm ? r.retiradoEm.toISOString() : null,
      retiradoPorNome: r.retiradoPor?.name ?? null,
    };
  });

  return NextResponse.json({
    encontrado: true,
    cpf,
    nome,
    reservas: reservasFmt,
    totalDisponiveis,
    totalRetirados,
  });
}
