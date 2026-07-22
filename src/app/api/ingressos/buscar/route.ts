// src/app/api/ingressos/buscar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCpf } from "@/lib/cpf";

const rolesPermitidos = ["dev", "admin", "operador"];

async function handle(cpfRaw: string) {
  const cpf = normalizeCpf(cpfRaw);
  if (cpf.length !== 11) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  try {
    const reservas = await prisma.reservaIngresso.findMany({
      where: { cpf },
      select: {
        id: true,
        protocolo: true,
        nome: true,
        retirado: true,
        retiradoEm: true,
        retiradoPor: { select: { name: true } },
        lote: {
          select: {
            showData: true,  // DateTime @db.Date
            showLabel: true, // rótulo do show
          },
        },
      },
      orderBy: { lote: { showData: "asc" } },
    });

    // ✅ DEDUP por protocolo. Se houver 2 linhas do mesmo protocolo:
    //   1º) mantém a que já foi retirada (preserva histórico)
    //   2º) prefere a que NÃO começa com "Show " no showLabel
    const porProtocolo = new Map<string, (typeof reservas)[number]>();
    for (const r of reservas) {
      const chave = r.protocolo ?? r.id; // sem protocolo → não dedup
      const atual = porProtocolo.get(chave);

      if (!atual) {
        porProtocolo.set(chave, r);
        continue;
      }

      const atualEhShow = /^show\s/i.test((atual.lote?.showLabel ?? "").trim());
      const novoEhShow = /^show\s/i.test((r.lote?.showLabel ?? "").trim());

      if (r.retirado && !atual.retirado) {
        porProtocolo.set(chave, r);
      } else if (r.retirado === atual.retirado && atualEhShow && !novoEhShow) {
        porProtocolo.set(chave, r);
      }
    }

    const unicas = Array.from(porProtocolo.values());

    const totalRetirados = unicas.filter((r) => r.retirado).length;
    const totalDisponiveis = unicas.length - totalRetirados;

    return NextResponse.json({
      cpf,
      encontrado: unicas.length > 0,
      nome: unicas[0]?.nome ?? null,
      totalDisponiveis,
      totalRetirados,
      reservas: unicas.map((r) => ({
        id: r.id,
        protocolo: r.protocolo ?? "—",
        nome: r.nome ?? "—",
        showLabel: r.lote?.showLabel ?? "—",
        showData: r.lote?.showData ? r.lote.showData.toISOString() : null,
        retirado: r.retirado,
        retiradoEm: r.retiradoEm ? r.retiradoEm.toISOString() : null,
        retiradoPorNome: r.retiradoPor?.name ?? null,
      })),
    });
  } catch (e) {
    console.error("[ingressos/buscar] falha ao buscar reservas:", e);
    return NextResponse.json(
      { error: "Falha ao consultar as reservas. Tente de novo." },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!rolesPermitidos.includes(session.user.role as string)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  return handle(body?.cpf ?? "");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!rolesPermitidos.includes(session.user.role as string)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const cpf = req.nextUrl.searchParams.get("cpf") ?? "";
  return handle(cpf);
}
