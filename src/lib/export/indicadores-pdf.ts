import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IndicadoresData } from './indicadores-data';

/* ------------------------------------------------------------------ */
/* Cores institucionais Annonae                                        */
/* ------------------------------------------------------------------ */
const VERDE: [number, number, number] = [22, 163, 74]; // #16a34a
const CINZA_ESCURO: [number, number, number] = [55, 65, 81]; // #374151
const CINZA_CLARO: [number, number, number] = [243, 244, 246]; // #f3f4f6

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatarPeriodo(from: string | null, to: string | null): string {
  const f = from ? new Date(from).toLocaleDateString('pt-BR') : '—';
  const t = to ? new Date(to).toLocaleDateString('pt-BR') : '—';
  return `${f} a ${t}`;
}

/**
 * Lê a logo do disco e converte para base64 (data URI).
 * Falha graciosamente: se não achar o arquivo, retorna null (PDF sai sem logo).
 */
function carregarLogoBase64(): string | null {
  try {
    const caminho = join(process.cwd(), 'public', 'logos', 'annonae-color.png');
    const buf = readFileSync(caminho);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Geração do PDF                                                      */
/* ------------------------------------------------------------------ */

export function gerarPdfIndicadores(data: IndicadoresData): Buffer {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  /* ----------------------------- HEADER ----------------------------- */
  const logo = carregarLogoBase64();
  if (logo) {
    try {
      // logo quadrada ~18mm no canto superior esquerdo
      doc.addImage(logo, 'PNG', margin, 12, 18, 18);
    } catch {
      /* ignora erro de imagem */
    }
  }

  const textX = logo ? margin + 22 : margin;

  doc.setTextColor(...VERDE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Annonae', textX, 19);

  doc.setTextColor(...CINZA_ESCURO);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Relatório de Indicadores', textX, 26);

  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Período: ${formatarPeriodo(data.periodo.from, data.periodo.to)}`,
    textX,
    31,
  );

  // selo de censura no canto direito
  doc.setFontSize(8);
  doc.setTextColor(...(data.censurado ? CINZA_ESCURO : VERDE));
  doc.text(
    data.censurado ? 'Dados censurados' : 'Dados completos',
    pageWidth - margin,
    19,
    { align: 'right' },
  );
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Emitido em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth - margin,
    24,
    { align: 'right' },
  );

  // linha divisória
  doc.setDrawColor(...VERDE);
  doc.setLineWidth(0.5);
  doc.line(margin, 35, pageWidth - margin, 35);

  let cursorY = 42;

  /* --------------------------- KPIs (macro) ------------------------- */
  doc.setFontSize(13);
  doc.setTextColor(...CINZA_ESCURO);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', margin, cursorY);
  cursorY += 2;

  autoTable(doc, {
    startY: cursorY + 2,
    head: [['Indicador', 'Valor', 'Unidade']],
    body: [
      ['Total Doado', data.macro.totalDoado.toLocaleString('pt-BR'), 'kg'],
      [
        'Distribuído',
        data.macro.totalDistribuido.toLocaleString('pt-BR'),
        'kg',
      ],
      ['Colheita', data.macro.totalColheita.toLocaleString('pt-BR'), 'kg'],
      ['Em Estoque', data.macro.emEstoque.toLocaleString('pt-BR'), 'kg'],
      [
        'Aproveitamento',
        data.macro.percentualAproveitamento.toLocaleString('pt-BR'),
        '%',
      ],
      [
        'Beneficiários Atendidos',
        String(data.macro.beneficiariosAtendidos),
        '',
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CINZA_CLARO },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  // @ts-expect-error lastAutoTable é injetado pelo plugin autotable
  cursorY = doc.lastAutoTable.finalY + 10;

  /* ------------------------- Tendência mensal ----------------------- */
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CINZA_ESCURO);
  doc.text('Tendência Mensal', margin, cursorY);

  autoTable(doc, {
    startY: cursorY + 4,
    head: [['Mês', 'Doações (kg)', 'Distribuições (kg)', 'Colheita (kg)']],
    body: data.tendencia.map((t) => [
      t.mes,
      t.doacoes.toLocaleString('pt-BR'),
      t.distribuicoes.toLocaleString('pt-BR'),
      t.colheita.toLocaleString('pt-BR'),
    ]),
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: CINZA_CLARO },
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 2 },
  });

  // @ts-expect-error lastAutoTable injetado pelo plugin
  cursorY = doc.lastAutoTable.finalY + 10;

  /* --------------------------- Rankings ----------------------------- */
  const addRankingTable = (
    titulo: string,
    coluna: string,
    rows: Array<{ nome: string; total: number }>,
  ) => {
    // quebra de página se faltar espaço
    const pageHeight = doc.internal.pageSize.getHeight();
    if (cursorY > pageHeight - 40) {
      doc.addPage();
      cursorY = 20;
    }

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CINZA_ESCURO);
    doc.text(titulo, margin, cursorY);

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['#', coluna, 'Total (kg)']],
      body: rows.map((r, i) => [
        String(i + 1),
        r.nome,
        r.total.toLocaleString('pt-BR'),
      ]),
      theme: 'striped',
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CINZA_CLARO },
      columnStyles: { 0: { cellWidth: 12 }, 2: { cellWidth: 30 } },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2 },
    });

    // @ts-expect-error lastAutoTable injetado pelo plugin
    cursorY = doc.lastAutoTable.finalY + 10;
  };

  addRankingTable('Top 10 Produtos Doados', 'Produto', data.topProdutos);
  addRankingTable('Top 10 Doadores', 'Doador', data.topDoadores);
  addRankingTable('Top 10 Beneficiários', 'Beneficiário', data.topBeneficiarios);
  addRankingTable('Top 10 Produtores Rurais', 'Produtor', data.topProdutores);

  /* ----------------------------- FOOTER ----------------------------- */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Gerado por Annonae · Banco de Alimentos de São João del-Rei',
      margin,
      pageHeight - 7,
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 7, {
      align: 'right',
    });
  }

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
