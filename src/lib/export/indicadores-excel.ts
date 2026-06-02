import * as XLSX from 'xlsx';
import type { IndicadoresData } from './indicadores-data';

function formatarPeriodo(from: string | null, to: string | null): string {
  const f = from ? new Date(from).toLocaleDateString('pt-BR') : '—';
  const t = to ? new Date(to).toLocaleDateString('pt-BR') : '—';
  return `${f} a ${t}`;
}

export function gerarExcelIndicadores(data: IndicadoresData): Buffer {
  const wb = XLSX.utils.book_new();

  /* ----------------------------- Resumo ----------------------------- */
  const resumoRows = [
    ['Banco de Alimentos — Relatório de Indicadores'],
    ['Gerado por', 'Annonae'],
    ['Período', formatarPeriodo(data.periodo.from, data.periodo.to)],
    ['Dados censurados', data.censurado ? 'Sim' : 'Não'],
    ['Emitido em', new Date().toLocaleString('pt-BR')],
    [],
    ['Indicador', 'Valor', 'Unidade'],
    ['Total Doado', data.macro.totalDoado, 'kg'],
    ['Distribuído', data.macro.totalDistribuido, 'kg'],
    ['Colheita', data.macro.totalColheita, 'kg'],
    ['Em Estoque', data.macro.emEstoque, 'kg'],
    ['Aproveitamento', data.macro.percentualAproveitamento, '%'],
    ['Beneficiários Atendidos', data.macro.beneficiariosAtendidos, ''],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  /* --------------------------- Tendência ---------------------------- */
  const tendRows = [
    ['Mês', 'Doações (kg)', 'Distribuições (kg)', 'Colheita (kg)'],
    ...data.tendencia.map((t) => [
      t.mes,
      t.doacoes,
      t.distribuicoes,
      t.colheita,
    ]),
  ];
  const wsTend = XLSX.utils.aoa_to_sheet(tendRows);
  wsTend['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsTend, 'Tendência Mensal');

  /* ------------------------ Rankings (helper) ----------------------- */
  const addRanking = (
    nome: string,
    titulo: string,
    rows: Array<{ nome: string; total: number }>,
  ) => {
    const aoa = [
      ['#', titulo, 'Total (kg)'],
      ...rows.map((r, i) => [i + 1, r.nome, r.total]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };

  addRanking('Top Produtos', 'Produto', data.topProdutos);
  addRanking('Top Doadores', 'Doador', data.topDoadores);
  addRanking('Top Beneficiários', 'Beneficiário', data.topBeneficiarios);
  addRanking('Top Produtores', 'Produtor', data.topProdutores);

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf as Buffer;
}
