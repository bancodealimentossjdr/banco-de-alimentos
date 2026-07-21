// src/app/api/ingressos/reverter/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * ↩️ Reverte a retirada de um ingresso.
 *
 * Regra de segurança (defesa em profundidade):
 *   - requireAuth (sessão válida)
 *   - SÓ role === 'dev' pode reverter (backend nunca confia no front)
 *
 * Efeito: retirado:true → false, limpa retiradoEm e retiradoPorId.
 * ⚠️ NÃO toca em ShowContador — esse modelo é numeração de cupons de
 * arrecadação extra e não tem relação com ReservaIngresso.
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  // 🔒 Gate por role no servidor
  if (session.user.role !== "dev") {
    return NextResponse.json(
      { error: "Apenas o desenvolvedor pode reverter retiradas." },
      { status: 403 }
    );
  }

  let body: { reservaId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { reservaId } = body;
  if (!reservaId) {
    return NextResponse.json({ error: "reservaId obrigatório" }, { status: 400 });
  }

  try {
    const reserva = await prisma.$transaction(async (tx) => {
      const alvo = await tx.reservaIngresso.findUnique({
        where: { id: reservaId },
        select: { id: true, retirado: true },
      });

      if (!alvo) throw { status: 404, msg: "Reserva não encontrada" };
      if (!alvo.retirado)
        throw { status: 409, msg: "Este ingresso não está retirado" };

      // 🔒 Atômico: só reverte se ainda estiver retirado:true
      const upd = await tx.reservaIngresso.updateMany({
        where: { id: reservaId, retirado: true },
        data: { retirado: false, retiradoEm: null, retiradoPorId: null },
      });
      if (upd.count === 0)
        throw { status: 409, msg: "Este ingresso não está retirado" };

      return tx.reservaIngresso.findUnique({
        where: { id: reservaId },
        select: {
          id: true,
          protocolo: true,
          nome: true,
          retirado: true,
          retiradoEm: true,
        },
      });
    });

    return NextResponse.json({ ok: true, reserva });
  } catch (e: unknown) {
    const err = e as { status?: number; msg?: string };
    if (err.status) {
      return NextResponse.json({ error: err.msg }, { status: err.status });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
