import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buscarReservasPorCpf } from "@/lib/appcidades";
import { normalizeCpf } from "@/lib/cpf";

const rolesPermitidos = ["dev", "admin", "operador"];

async function handle(cpfRaw: string) {
  const cpf = normalizeCpf(cpfRaw);
  if (cpf.length !== 11) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  const reservas = await buscarReservasPorCpf(cpf);

  return NextResponse.json({
    cpf,
    encontrado: reservas.length > 0,
    nome: reservas[0]?.nome ?? null,
    reservas: reservas.map((r) => ({
      id: r.protocolo ?? `${r.formId}-${cpf}`,
      protocolo: r.protocolo ?? "—",
      showLabel:
        r.showDia === "2026-08-13"
          ? "13/08 • Hugo e Guilherme"
          : r.showDia === "2026-08-15"
          ? "15/08 • Daniel"
          : r.showDia === "2026-08-16"
          ? "16/08 • Mariana Fagundes"
          : r.showDia,
      showData: `${r.showDia}T00:00:00.000Z`,
      retirado: false,
      retiradoEm: null,
      retiradoPorNome: null,
    })),
  });
}

// POST — body { cpf }
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

// GET — ?cpf=... (fallback que estava dando 405)
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
