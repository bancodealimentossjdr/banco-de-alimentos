// src/app/api/ingressos/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdminOrDev } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cpfPorRole } from "@/lib/mask";
import { BRANDING } from "@/lib/branding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEX_VERDE = "FF14532D";
const HEX_OURO = "FFC9A227";

// GET /api/ingressos/export
//   ?loteId=xxx      → exporta só um lote (opcional)
//   ?retirado=1|0    → filtra por status (opcional)
// Sem filtros = exporta TODAS as reservas
//
// 🔐 ONDA 22 — gate corrigido: exige dev OU admin.
//    Antes exigia apenas sessão válida, o que permitia a um
//    VISUALIZADOR baixar a planilha completa com CPF cru.
//    CPF cru agora é exclusivo do dev; admin recebe mascarado.
export async function GET(req: NextRequest) {
  const result = await requireAdminOrDev();
  if (result instanceof NextResponse) return result;

  const isDev = result.user.role === "dev";
  const nomeUsuario = result.user.name ?? result.user.email ?? "—";

  const sp = req.nextUrl.searchParams;
  const loteId = sp.get("loteId") || undefined;
  const retiradoParam = sp.get("retirado");

  const where: {
    loteId?: string;
    retirado?: boolean;
  } = {};
  if (loteId) where.loteId = loteId;
  if (retiradoParam === "1") where.retirado = true;
  if (retiradoParam === "0") where.retirado = false;

  const reservas = await prisma.reservaIngresso.findMany({
    where,
    orderBy: [{ lote: { showData: "asc" } }, { protocolo: "asc" }],
    include: {
      lote: { select: { showLabel: true, showData: true, nomeArquivo: true } },
      retiradoPor: { select: { name: true } },
    },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = BRANDING.name;
  wb.created = new Date();

  const ws = wb.addWorksheet("Reservas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "Protocolo", key: "protocolo", width: 18 },
    { header: "CPF", key: "cpf", width: 16 },
    { header: "Nome", key: "nome", width: 32 },
    { header: "Data Nasc.", key: "dataNasc", width: 14 },
    { header: "Cidade", key: "cidade", width: 20 },
    { header: "Bairro", key: "bairro", width: 20 },
    { header: "Show", key: "showLabel", width: 24 },
    { header: "Data Show", key: "showData", width: 14 },
    { header: "Retirado", key: "retirado", width: 12 },
    { header: "Retirado em", key: "retiradoEm", width: 20 },
    { header: "Retirado por", key: "retiradoPor", width: 24 },
    { header: "Arquivo Lote", key: "nomeArquivo", width: 28 },
  ];

  // 🎨 Cabeçalho com identidade Annonae (Onda 21)
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEX_VERDE },
  };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  header.eachCell((c) => {
    c.border = { bottom: { style: "thin", color: { argb: HEX_OURO } } };
  });

  const fmtDataHora = (d: Date | null) =>
    d
      ? new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        }).format(d)
      : "";

  const fmtData = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);

  for (const r of reservas) {
    const row = ws.addRow({
      protocolo: r.protocolo,
      cpf: cpfPorRole(r.cpf, isDev),
      nome: r.nome,
      dataNasc: r.dataNasc ?? "",
      cidade: r.cidade ?? "",
      bairro: r.bairro ?? "",
      showLabel: r.lote.showLabel,
      showData: fmtData(r.lote.showData),
      retirado: r.retirado ? "SIM" : "NÃO",
      retiradoEm: fmtDataHora(r.retiradoEm),
      retiradoPor: r.retiradoPor?.name ?? "",
      nomeArquivo: r.lote.nomeArquivo,
    });
    // 🔒 CPF e protocolo como texto — evita o Excel comer zero à esquerda
    row.getCell("cpf").numFmt = "@";
    row.getCell("protocolo").numFmt = "@";
  }

  // Colore a coluna "Retirado"
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const cell = row.getCell("retirado");
    const sim = cell.value === "SIM";
    cell.font = { bold: true, color: { argb: sim ? "FF047857" : "FF6B7280" } };
    cell.alignment = { horizontal: "center" };
  });

  if (reservas.length > 0) {
    ws.autoFilter = { from: "A1", to: "L1" };
  }

  // 📋 Aba de proveniência — prestação de contas
  const wsMeta = wb.addWorksheet("Sobre");
  wsMeta.columns = [
    { header: "Campo", key: "k", width: 24 },
    { header: "Valor", key: "v", width: 52 },
  ];
  wsMeta.addRows([
    { k: "Sistema", v: BRANDING.name },
    { k: "Relatório", v: "Reservas de ingresso social" },
    {
      k: "Gerado em",
      v: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    },
    { k: "Gerado por", v: nomeUsuario },
    { k: "CPF", v: isDev ? "completo (dev)" : "mascarado" },
    { k: "Total de reservas", v: String(reservas.length) },
    { k: "Filtro lote", v: loteId ?? "todos" },
    {
      k: "Filtro retirado",
      v: retiradoParam === "1" ? "sim" : retiradoParam === "0" ? "não" : "todos",
    },
  ]);
  const metaHead = wsMeta.getRow(1);
  metaHead.font = { bold: true, color: { argb: "FFFFFFFF" } };
  metaHead.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEX_VERDE },
  };

  const buffer = await wb.xlsx.writeBuffer();

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const filename = `annonae-ingressos-${stamp}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
