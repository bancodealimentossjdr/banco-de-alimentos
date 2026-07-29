// src/app/api/ingressos/buscar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCpf } from "@/lib/cpf";

// 🔑 Node runtime + sem cache (era isso que quebrava em produção)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rolesPermitidos = ["dev", "admin", "operador"];

// ── Config App Cidades ──────────────────────────────────
const BASE = "https://backend.appcidades.com.br";
const CIDADE = "sao_joao_del_rei_mg";
const TOKEN = process.env.APPCIDADES_TOKEN;

// Mapeia formId da API → lote no banco
const SHOWS = [
  { id: 162, showLabel: "13/08 • Hugo e Guilherme", showData: "2026-08-13" },
  { id: 163, showLabel: "15/08 • Daniel",           showData: "2026-08-15" },
  { id: 164, showLabel: "16/08 • Mariana Fagundes", showData: "2026-08-16" },
];

// ── Chama a API externa para 1 show (tolerante a falha) ──
async function buscarShowNaApi(formId: number, cpf: string) {
  if (!TOKEN) return [];

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);

  try {
    const res = await fetch(`${BASE}/formularios/${formId}/respostas/filter`, {
      method: "POST",
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        cidade: CIDADE,
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reset: false,
        filtroProtocoloSearch: null,
        filtroNomeSearch: null,
        filtroCpfSearch: cpf,
        filtroStatusSearch: "FINALIZADA",
        revisadaSearch: -1,
        voltouRecusaSearch: -1,
        recusadaSearch: -1,
        assinaturaCidadaoSearch: -1,
        anonimoSearch: -1,
        page: 0,
        size: 50,
        sorts: [],
        filtroPerguntaSearch: null,
        perguntaId: null,
      }),
    });

    if (!res.ok) {
      console.error(`[ingressos/buscar] API form ${formId} → HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const content: any[] = Array.isArray(json?.content) ? json.content : [];

    return content
      .filter((c) => c?.statusResposta === "FINALIZADA")
      .map((c) => ({
        formId,
        protocolo: String(c?.protocolo ?? "").trim(),
        nome: String(c?.cidadao?.nome ?? "").trim(),
      }))
      .filter((r) => r.protocolo !== "");
  } catch (e) {
    console.error(`[ingressos/buscar] API form ${formId} falhou:`, e);
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ── Garante o LoteIngresso do show (cria se não existir) ─
async function garantirLote(formId: number, importadoPorId: string) {
  const show = SHOWS.find((s) => s.id === formId)!;
  const nomeArquivo = `api-appcidades-${formId}`; // @unique estável

  return prisma.loteIngresso.upsert({
    where: { nomeArquivo },
    create: {
      nomeArquivo,
      operador: "API App Cidades",
      showData: new Date(`${show.showData}T00:00:00Z`),
      showLabel: show.showLabel,
      importadoPorId,
      totalLinhas: 0,
    },
    update: {},
    select: { id: true },
  });
}

async function handle(cpfRaw: string, userId: string) {
  const cpf = normalizeCpf(cpfRaw);
  if (cpf.length !== 11) {
    return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
  }

  // 1️⃣ TEMPO REAL: busca os 3 shows na API em paralelo (tolerante a falha)
  const encontradosNaApi = (
    await Promise.all(SHOWS.map((s) => buscarShowNaApi(s.id, cpf)))
  ).flat();

  // 2️⃣ SINCRONIZA sem inflar:
  //    - Se o protocolo JÁ existe em QUALQUER lote → só atualiza nome.
  //    - Se NÃO existe em lugar nenhum → cria no lote da API.
  //    Nunca toca em retirado/retiradoEm/retiradoPorId.
  if (encontradosNaApi.length > 0) {
    try {
      // dedup dos protocolos vindos da API (a API não deveria repetir, mas garantimos)
      const vistos = new Set<string>();
      const daApi = encontradosNaApi.filter((r) => {
        if (vistos.has(r.protocolo)) return false;
        vistos.add(r.protocolo);
        return true;
      });

      // quais protocolos JÁ existem no banco (qualquer lote)?
      const jaExistem = await prisma.reservaIngresso.findMany({
        where: { protocolo: { in: daApi.map((r) => r.protocolo) } },
        select: { id: true, protocolo: true, nome: true },
      });
      const existentesPorProtocolo = new Map(
        jaExistem.map((r) => [r.protocolo, r]),
      );

      const novos = daApi.filter((r) => !existentesPorProtocolo.has(r.protocolo));

      // 2a) Cria lotes só para os shows que têm protocolo NOVO
      const loteDoForm = new Map<number, string>();
      const formIdsNovos = [...new Set(novos.map((r) => r.formId))];
      for (const fid of formIdsNovos) {
        const lote = await garantirLote(fid, userId);
        loteDoForm.set(fid, lote.id);
      }

      // 2b) Monta as operações
      const ops: any[] = [];

      // NOVOS → cria (única forma de o banco crescer, e só com verdade nova)
      for (const r of novos) {
        ops.push(
          prisma.reservaIngresso.create({
            data: {
              loteId: loteDoForm.get(r.formId)!,
              protocolo: r.protocolo,
              cpf,
              nome: r.nome || "—",
            },
            select: { id: true },
          }),
        );
      }

      // EXISTENTES → só atualiza nome se mudou (nunca duplica, nunca toca retirada)
      for (const [protocolo, existente] of existentesPorProtocolo) {
        const novoNome = daApi.find((r) => r.protocolo === protocolo)?.nome || "—";
        if (novoNome !== existente.nome && novoNome !== "—") {
          ops.push(
            prisma.reservaIngresso.update({
              where: { id: existente.id },
              data: { nome: novoNome },
              select: { id: true },
            }),
          );
        }
      }

      if (ops.length > 0) await prisma.$transaction(ops);
    } catch (e) {
      // Sincronização falhou? Segue com o que já existe no banco (fallback).
      console.error("[ingressos/buscar] falha ao sincronizar API→banco:", e);
    }
  }

  // 3️⃣ Lê do banco — fonte da verdade do controle de retirada
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
        lote: { select: { showData: true, showLabel: true } },
      },
      orderBy: { lote: { showData: "asc" } },
    });

    // ── DEDUP por protocolo — À PROVA DE ORDEM ──
    // Regra 1: retirada SEMPRE vence (preserva histórico, não importa quem chegou antes)
    // Regra 2: empate → prefere lote da API (showLabel NÃO começa com "Show ")
    const porProtocolo = new Map<string, (typeof reservas)[number]>();
    for (const r of reservas) {
      const chave = r.protocolo || r.id;
      const atual = porProtocolo.get(chave);
      if (!atual) {
        porProtocolo.set(chave, r);
        continue;
      }
      if (r.retirado && !atual.retirado) {
        porProtocolo.set(chave, r);
        continue;
      }
      if (!r.retirado && atual.retirado) {
        continue; // 🔒 blinda a retirada, independente da ordem
      }
      // empate em retirado → prefere quem NÃO é "Show " (lote da API)
      const atualEhShow = /^show\s/i.test((atual.lote?.showLabel ?? "").trim());
      const novoEhShow = /^show\s/i.test((r.lote?.showLabel ?? "").trim());
      if (atualEhShow && !novoEhShow) {
        porProtocolo.set(chave, r);
      }
    }

    const unicas = Array.from(porProtocolo.values());
    const totalRetirados = unicas.filter((r) => r.retirado).length;

    return NextResponse.json({
      cpf,
      encontrado: unicas.length > 0,
      nome: unicas[0]?.nome ?? null,
      totalDisponiveis: unicas.length - totalRetirados,
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
    console.error("[ingressos/buscar] falha ao ler banco:", e);
    return NextResponse.json(
      { error: "Falha ao consultar as reservas. Tente de novo." },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!rolesPermitidos.includes(session.user.role as string))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  return handle(body?.cpf ?? "", session.user.id);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!rolesPermitidos.includes(session.user.role as string))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const cpf = req.nextUrl.searchParams.get("cpf") ?? "";
  return handle(cpf, session.user.id);
}
