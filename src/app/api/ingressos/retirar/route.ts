// src/app/api/ingressos/retirar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const TETO_POR_CPF = 3;

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;

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
        select: {
          id: true,
          cpf: true,
          protocolo: true,
          retirado: true,
          retiradoEm: true,
        },
      });

      if (!alvo) throw { status: 404, msg: "Reserva não encontrada" };
      if (alvo.retirado)
        throw { status: 409, msg: "Ingresso já retirado", retiradoEm: alvo.retiradoEm };

      // 🔒 Teto 3 por CPF — conta PROTOCOLOS distintos já retirados (evita
      // contar duplicatas do mesmo ingresso como se fossem vários).
      const retiradosCpf = await tx.reservaIngresso.findMany({
        where: { cpf: alvo.cpf, retirado: true },
        select: { protocolo: true },
      });
      const protocolosRetirados = new Set(
        retiradosCpf.map((r) => r.protocolo ?? "").filter(Boolean)
      );
      if (protocolosRetirados.size >= TETO_POR_CPF) {
        throw { status: 422, msg: `Limite de ${TETO_POR_CPF} ingressos por CPF atingido` };
      }

      // 🔒 Atômico: marca TODAS as linhas do mesmo protocolo (ou só a linha,
      // se não houver protocolo) que ainda estejam disponíveis.
      const where =
        alvo.protocolo && alvo.protocolo.trim()
          ? { cpf: alvo.cpf, protocolo: alvo.protocolo, retirado: false }
          : { id: reservaId, retirado: false };

      const upd = await tx.reservaIngresso.updateMany({
        where,
        data: { retirado: true, retiradoEm: new Date(), retiradoPorId: userId },
      });
      if (upd.count === 0) throw { status: 409, msg: "Ingresso já retirado" };

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
    const err = e as { status?: number; msg?: string; retiradoEm?: Date };
    if (err.status) {
      return NextResponse.json(
        { error: err.msg, retiradoEm: err.retiradoEm },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
