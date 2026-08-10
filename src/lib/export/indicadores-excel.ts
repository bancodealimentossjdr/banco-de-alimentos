import ExcelJS from 'exceljs';
import type { IndicadoresData } from './indicadores-data';

const HEX_VERDE = 'FF14532D';
const HEX_OURO = 'FFC9A227';

function formatarPeriodo(from: string | null, to: string | null): string {
  const f = from ? new Date(from).toLocaleDateString('pt-BR') : '—';
  const t = to ? new Date(to).toLocaleDateString('pt-BR') : '—';
  return `${f} a ${t}`;
}

/** Estiliza a linha de cabeçalho de uma aba (verde institucional + faixa ouro) */
function estilizarHeader(ws: ExcelJS.Worksheet, linha: number, colunas: number) {
  const row = ws.getRow(linha);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.height = 20;
  row.alignment = { vertical: 'middle' };
  for (let c = 1; c <= colunas; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX_VERDE } };
    cell.border = { bottom: { style: 'thin', color: { argb: HEX_OURO } } };
  }
}

/**
 * ⚠️ ONDA 21.6 — migrado de `xlsx` (SheetJS) para `exceljs`.
 * A função agora é ASSÍNCRONA: wb.xlsx.writeBuffer() retorna Promise.
 * Todo chamador precisa de `await`.
 */
export async function gerarExcelIndicadores(
  data: IndicadoresData,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Annonae';
  wb.created = new Date();

  /* ----------------------------- Resumo ----------------------------- */
  const wsResumo = wb.addWorksheet('Resumo');
  wsResumo.columns = [{ width: 28 }, { width: 22 }, { width: 10 }];

  const tituloRow = wsResumo.addRow([
    'Banco de Alimentos — Relatório de Indicadores',
  ]);
  tituloRow.font = { bold: true, size: 13, color: { argb: HEX_VERDE } };
  wsResumo.mergeCells(tituloRow.number, 1, tituloRow.number, 3);

  wsResumo.addRow(['Gerado por', 'Annonae']);
  wsResumo.addRow(['Período', formatarPeriodo(data.periodo.from, data.periodo.to)]);
  wsResumo.addRow(['Dados censurados', data.censurado ? 'Sim' : 'Não']);
  wsResumo.addRow(['Emitido em', new Date().toLocaleString('pt-BR')]);
  wsResumo.addRow([]);

  const headResumo = wsResumo.addRow(['Indicador', 'Valor', 'Unidade']);
  estilizarHeader(wsResumo, headResumo.number, 3);

  const indicadores: [string, number, string][] = [
    ['Total Doado', data.macro.totalDoado, 'kg'],
    ['Distribuído', data.macro.totalDistribuido, 'kg'],
    ['Colheita', data.macro.totalColheita, 'kg'],
    ['Em Estoque', data.macro.emEstoque, 'kg'],
    ['Aproveitamento', data.macro.percentualAproveitamento, '%'],
    ['Beneficiários Atendidos', data.macro.beneficiariosAtendidos, ''],
  ];
  for (const [nome, valor, unidade] of indicadores) {
    const row = wsResumo.addRow([nome, valor, unidade]);
    row.getCell(2).numFmt = '#,##0.00';
    row.getCell(2).alignment = { horizontal: 'right' };
  }

  /* --------------------------- Tendência ---------------------------- */
  const wsTend = wb.addWorksheet('Tendência Mensal');
  wsTend.columns = [
    { header: 'Mês', key: 'mes', width: 12 },
    { header: 'Doações (kg)', key: 'doacoes', width: 16 },
    { header: 'Distribuições (kg)', key: 'distribuicoes', width: 18 },
    { header: 'Colheita (kg)', key: 'colheita', width: 14 },
  ];
  estilizarHeader(wsTend, 1, 4);

  for (const t of data.tendencia) {
    const row = wsTend.addRow({
      mes: t.mes,
      doacoes: t.doacoes,
      distribuicoes: t.distribuicoes,
      colheita: t.colheita,
    });
    for (const c of [2, 3, 4]) row.getCell(c).numFmt = '#,##0.00';
  }
  wsTend.views = [{ state: 'frozen', ySplit: 1 }];

  /* ------------------------ Rankings (helper) ----------------------- */
  const addRanking = (
    nome: string,
    titulo: string,
    rows: Array<{ nome: string; total: number }>,
  ) => {
    const ws = wb.addWorksheet(nome);
    ws.columns = [
      { header: '#', key: 'pos', width: 5 },
      { header: titulo, key: 'nome', width: 32 },
      { header: 'Total (kg)', key: 'total', width: 12 },
    ];
    estilizarHeader(ws, 1, 3);

    rows.forEach((r, i) => {
      const row = ws.addRow({ pos: i + 1, nome: r.nome, total: r.total });
      row.getCell('total').numFmt = '#,##0.00';
      // 🏅 TOP 3 em destaque (paridade visual com o PDF da SubOnda 4)
      if (i < 3) {
        row.font = { bold: true, color: { argb: HEX_VERDE } };
        row.eachCell((c) => {
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFAF3DB' },
          };
        });
      }
    });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (rows.length > 0) {
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 3 } };
    }
  };

  addRanking('Top Produtos', 'Produto', data.topProdutos);
  addRanking('Top Doadores', 'Doador', data.topDoadores);
  addRanking('Top Beneficiários', 'Beneficiário', data.topBeneficiarios);
  addRanking('Top Produtores', 'Produtor', data.topProdutores);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
