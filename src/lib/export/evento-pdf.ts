import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface EventoExportData {
  nome: string
  status: string
  criadoPor: string | null
  totalKg: number
  refugoKg: number
  liquidoKg: number
  totalRecebimentos: number
  totalLocais: number
  totalAlimentos: number // 🆕 17.3
  porLocal: { nome: string; kg: number }[]
  // 🆕 17.3 — recebido + refugo por alimento
  porAlimento: {
    nome: string
    recebidoKg: number
    refugoKg: number
  }[]
  // operadores só vêm preenchidos quando isAdmin (já mascarados ou não no server)
  operadores: { nome: string; email: string; role: string }[] | null
  censurado: boolean
}

const fmtKg = (n: number) =>
  `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`


export function gerarPdfEvento(data: EventoExportData): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const verde: [number, number, number] = [34, 197, 94]
  let y = 48

  // ── Cabeçalho ──
  doc.setFontSize(18)
  doc.setTextColor(33, 140, 82)
  doc.text('Relatório do Evento de Arrecadação', 40, y)
  y += 24

  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text(data.nome, 40, y)
  y += 20

  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Status: ${data.status}`, 40, y)
  y += 14
  if (data.criadoPor) {
    doc.text(`Criado por: ${data.criadoPor}`, 40, y)
    y += 14
  }
  y += 6

  // ── Resumo (tabela) ──
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total recebido', fmtKg(data.totalKg)],
      ['Refugo', fmtKg(data.refugoKg)],
      ['Líquido (sem refugo)', fmtKg(data.liquidoKg)],
      ['Recebimentos', String(data.totalRecebimentos)],
      ['Locais', String(data.totalLocais)],
      ['Alimentos', String(data.totalAlimentos)], // 🆕
    ],
    theme: 'striped',
    headStyles: { fillColor: verde },
    styles: { fontSize: 10 },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 24

  // ── Quantidade por local ──
  autoTable(doc, {
    startY: y,
    head: [['Local de coleta', 'Recebido']],
    body:
      data.porLocal.length > 0
        ? data.porLocal.map((l) => [l.nome, fmtKg(l.kg)])
        : [['— sem recebimentos —', '']],
    theme: 'grid',
    headStyles: { fillColor: verde },
    styles: { fontSize: 10 },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 24

  // ── 🆕 17.3 — Recebido e refugo por alimento ──
  autoTable(doc, {
    startY: y,
    head: [['Alimento', 'Recebido', 'Refugo']],
    body:
      data.porAlimento.length > 0
        ? data.porAlimento.map((a) => [
            a.nome,
            fmtKg(a.recebidoKg),
            fmtKg(a.refugoKg),
          ])
        : [['— sem alimentos —', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: verde },
    styles: { fontSize: 10 },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 24

  // ── Operadores (só admin) ──
  if (data.operadores) {
    autoTable(doc, {
      startY: y,
      head: [['Operador', 'E-mail', 'Perfil']],
      body:
        data.operadores.length > 0
          ? data.operadores.map((o) => [o.nome, o.email, o.role])
          : [['— nenhum vinculado —', '', '']],
      theme: 'striped',
      headStyles: { fillColor: verde },
      styles: { fontSize: 9 },
    })
  }

  // ── Rodapé ──
  const tag = data.censurado
    ? 'Dados sensíveis mascarados'
    : 'DADOS SEM CENSURA (admin)'
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `${tag} — gerado em ${new Date().toLocaleString('pt-BR')} — by Annonae`,
    40,
    doc.internal.pageSize.getHeight() - 24,
  )

  return Buffer.from(doc.output('arraybuffer'))
}
