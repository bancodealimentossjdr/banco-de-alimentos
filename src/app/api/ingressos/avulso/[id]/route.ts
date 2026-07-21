import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function soDigitos(v: string) {
  return (v || "").replace(/\D/g, "");
}
function isDev(role?: string) {
  return (role ?? "").toLowerCase() === "dev";
}

// PATCH — editar (SÓ DEV)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isDev(session.user.role as string)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const { id } = await params;

  let body: { cpf?: string; nome?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const cpf = soDigitos(body.cpf ?? "");
  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();

  if (cpf.length !== 11) {
    return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  }
  if (nome.length < 2) {
    return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  try {
    const atualizado = await prisma.trocaAvulsa.update({
      where: { id },
      data: { cpf, nome, email },
      select: { id: true, cpf: true, nome: true, email: true, createdAt: true },
    });
    return NextResponse.json({
      ok: true,
      registro: {
        ...atualizado,
        createdAt: atualizado.createdAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }
}

// DELETE — excluir (SÓ DEV)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!isDev(session.user.role as string)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.trocaAvulsa.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }
}
