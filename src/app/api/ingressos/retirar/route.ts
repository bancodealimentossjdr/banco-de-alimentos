// src/app/api/ingressos/retirar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TETO_POR_CPF = 3;

// 🔒 #4 — quem PODE registrar retirada. Visualizador precisa de vínculo ativo.
const ROLES_LIVRES = ["dev", "admin", "operador"];

export async function POST(req: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const userId = session.user.id;
  const role = session.user.role as string;

  let body: { reservaId?: string; eventoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { reservaId, eventoId } = body;
  if (!reservaId) {
    return NextResponse.json({ error: "reservaId obrigatório" }, { status: 400 });
  }

  // 🔒 #4 — Gate de permissão NO SERVER (backend nunca confia no front)
  let podeRegistrar = ROLES_LIVRES.includes(role);
  if (!podeRegistrar && role === "visualizador" && eventoId) {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    });
    podeRegistrar = vinculo?.ativo === true;
  }
  if (!podeRegistrar) {
    return NextResponse.json(
      { error: "Você não tem permissão para registrar retiradas." },
      { status: 403 }
    );
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

      // 🔒 Teto por CPF — conta PROTOCOLOS distintos já retirados
      const retiradosCpf = await tx.reservaIngresso.findMany({
        where: { cpf: alvo.cpf, retirado: true },
        select: { protocolo: true },
      });
      const protocolosRetirados = new Set(
        retiradosCpf.map((r) => r.protocolo ?? "").filter(Boolean)
      );
      if (protocolosRetirados.size >= TETO_POR_CPF) {
        throw {
          status: 422,
          msg: `Limite de ${TETO_POR_CPF} ingressos por CPF atingido`,
        };
      }

      // 🔒 Atômico: marca todas as linhas do mesmo protocolo ainda disponíveis
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
    console.error("[ingressos/retirar] erro:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
