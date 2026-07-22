import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EVENTO_ID = "cmrbncyk30001lcocxk7py4rb";

// 🎤 Line-up de TROCA — Ana Castela NÃO troca (só "Conheça seu Ídolo")
const SHOWS_VALIDOS = new Set([
  "hugo-guilherme-13",
  "daniel-15",
  "mariana-fagundes-16",
]);

function soDigitos(v: string) {
  return (v || "").replace(/\D/g, "");
}
function podeVer(role?: string) {
  const r = (role ?? "").toLowerCase();
  return r === "dev" || r === "admin";
}

// POST — registra troca avulsa (qualquer operador autenticado)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { cpf?: string; nome?: string; email?: string; shows?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const cpf = soDigitos(body.cpf ?? "");
  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();

  // shows: dedup + valida contra o line-up (Ana Castela é descartada aqui)
  const shows = Array.from(new Set(body.shows ?? [])).filter((s) =>
    SHOWS_VALIDOS.has(s)
  );

  if (cpf.length !== 11) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }
  if (nome.length < 2) {
    return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (shows.length === 0) {
    return NextResponse.json(
      { error: "Selecione ao menos um show." },
      { status: 400 }
    );
  }

  const registro = await prisma.trocaAvulsa.create({
    data: {
      eventoId: EVENTO_ID,
      cpf,
      nome,
      email,
      shows: { create: shows.map((showDia) => ({ showDia })) },
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: registro.id }, { status: 201 });
}

// GET — lista paginada (dev/admin) — cursor infinito, 20 por página
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!podeVer(session.user.role as string)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor");
  const take = 20;

  const registros = await prisma.trocaAvulsa.findMany({
    where: { eventoId: EVENTO_ID },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      cpf: true,
      nome: true,
      email: true,
      createdAt: true,
      shows: { select: { showDia: true } },
    },
  });

  const temMais = registros.length > take;
  const itens = temMais ? registros.slice(0, take) : registros;
  const proxCursor = temMais ? itens[itens.length - 1].id : null;

  return NextResponse.json({
    itens: itens.map((r) => ({
      id: r.id,
      cpf: r.cpf,
      nome: r.nome,
      email: r.email,
      createdAt: r.createdAt.toISOString(),
      shows: r.shows.map((s) => s.showDia),
    })),
    proxCursor,
  });
}
