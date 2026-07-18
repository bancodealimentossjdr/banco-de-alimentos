import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const operadorId = session.user.id;

  const body = await req.json().catch(() => null);
  const reservaId: string | undefined = body?.reservaId;

  if (!reservaId) {
    return NextResponse.json({ error: "reservaId ausente" }, { status: 400 });
  }

  const reserva = await prisma.reservaIngresso.findUnique({
    where: { id: reservaId },
    include: { lote: { select: { showLabel: true, showData: true } } },
  });

  if (!reserva) {
    return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
  }

  if (reserva.retirado) {
    return NextResponse.json(
      { error: "Ingresso já retirado", retiradoEm: reserva.retiradoEm },
      { status: 409 }
    );
  }

  // 🔒 Update condicional: só marca se ainda estiver disponível.
  // Evita corrida (dois operadores retirando o mesmo ingresso ao mesmo tempo).
  const resultado = await prisma.reservaIngresso.updateMany({
    where: { id: reservaId, retirado: false },
    data: {
      retirado: true,
      retiradoEm: new Date(),
      retiradoPorId: operadorId,
    },
  });

  if (resultado.count === 0) {
    return NextResponse.json(
      { error: "Ingresso já retirado" },
      { status: 409 }
    );
  }

  const atualizada = await prisma.reservaIngresso.findUnique({
    where: { id: reservaId },
    include: {
      lote: { select: { showLabel: true, showData: true } },
      retiradoPor: { select: { name: true } },
    },
  });

  return NextResponse.json({
    ok: true,
    reserva: {
      id: atualizada!.id,
      protocolo: atualizada!.protocolo,
      showLabel: atualizada!.lote.showLabel,
      showData: atualizada!.lote.showData,
      retirado: atualizada!.retirado,
      retiradoEm: atualizada!.retiradoEm,
      retiradoPorNome: atualizada!.retiradoPor?.name ?? null,
    },
  });
}
