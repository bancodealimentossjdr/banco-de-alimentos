import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/ingressos/export
//   ?loteId=xxx      → exporta só um lote (opcional)
//   ?retirado=1|0    → filtra por status (opcional)
// Sem filtros = exporta TODAS as reservas (espelho completo p/ o programador)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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
  wb.creator = "Annonae — Banco de Alimentos SJDR";
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

  // Cabeçalho em negrito + fundo
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB45309" }, // amber-700
  };
  header.alignment = { vertical: "middle" };

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
    ws.addRow({
      protocolo: r.protocolo,
      cpf: r.cpf,
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
  }

  // Colore a coluna "Retirado"
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const cell = row.getCell("retirado");
    const sim = cell.value === "SIM";
    cell.font = { bold: true, color: { argb: sim ? "FF047857" : "FF6B7280" } };
    cell.alignment = { horizontal: "center" };
  });

  ws.autoFilter = { from: "A1", to: "L1" };

  const buffer = await wb.xlsx.writeBuffer();

  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, "-");
  const filename = `ingressos-annonae-${stamp}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
