// src/app/api/eventos/[id]/arrecadacao-extra/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { cpfPorRole } from '@/lib/mask'
import { BRANDING } from '@/lib/branding'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── paleta institucional ───
const VERDE: [number, number, number] = [20, 83, 45]
const OURO: [number, number, number] = [201, 162, 39]
const CINZA: [number, number, number] = [110, 110, 110]
const MARGEM = 40

// hex p/ exceljs (ARGB)
const HEX_VERDE = 'FF14532D'
const HEX_OURO = 'FFC9A227'

// 🎤 Line-up FIXO — espelha Client.tsx e a folha-resumo
const SHOWS = [
  { value: 'hugo-guilherme-13', artista: 'Hugo e Guilherme', data: '13/08' },
  { value: 'ana-castela-14', artista: 'Ana Castela', data: '14/08' },
  { value: 'daniel-15', artista: 'Daniel', data: '15/08' },
  { value: 'mariana-fagundes-16', artista: 'Mariana Fagundes', data: '16/08' },
] as const

function labelShow(v: string): string {
  const s = SHOWS.find((x) => x.value === v)
  return s ? `${s.data} — ${s.artista}` : v
}

const fmtBR = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

function carregarLogo(): string | null {
  try {
    const caminho = join(process.cwd(), 'public', 'logos', 'annonae-color.png')
    return `data:image/png;base64,${readFileSync(caminho).toString('base64')}`
  } catch {
    return null
  }
}

const COLUNAS = [
  'Doador',
  'CPF',
  'Local',
  'Show',
  'Alimento',
  'Cupons',
  'Faixa',
  'Operador',
  'Data/Hora',
] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 🔐 ONDA 21.6 — gate server-side: dev OU admin.
  // ⚠️ NÃO exige evento ATIVO: relatório precisa funcionar após encerramento.
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  const role = result.user.role
  if (role !== 'dev' && role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const isDev = role === 'dev'
  const nomeUsuario = result.user.name ?? result.user.email ?? '—'

  const { id: eventoId } = await params

  const formato = (req.nextUrl.searchParams.get('format') ?? 'pdf').toLowerCase()
  if (!['pdf', 'xlsx', 'csv'].includes(formato)) {
    return NextResponse.json(
      { error: 'Formato inválido. Use pdf, xlsx ou csv.' },
      { status: 400 },
    )
  }

  // filtro de período (YYYY-MM-DD) sobre createdAt do registro
  const inicioParam = req.nextUrl.searchParams.get('inicio')
  const fimParam = req.nextUrl.searchParams.get('fim')
  const dtInicio = inicioParam ? new Date(`${inicioParam}T00:00:00.000Z`) : null
  const dtFim = fimParam ? new Date(`${fimParam}T23:59:59.999Z`) : null

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, nome: true, status: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não localizado' }, { status: 404 })
  }

  const registros = await prisma.arrecadacaoExtra.findMany({
    where: {
      eventoId,
      ...(dtInicio || dtFim
        ? {
            createdAt: {
              ...(dtInicio ? { gte: dtInicio } : {}),
              ...(dtFim ? { lte: dtFim } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      doadorNome: true,
      doadorCpf: true,
      createdAt: true,
      local: { select: { nome: true } },
      operador: { select: { name: true, email: true } },
      itens: {
        orderBy: { numeroInicio: 'asc' },
        select: {
          showDia: true,
          quantidade: true,
          numeroInicio: true,
          numeroFim: true,
          alimento: { select: { product: { select: { name: true } } } },
        },
      },
    },
  })

  // 🎭 CPF: dev → cru | admin → mascarado. Decidido no SERVIDOR.
  const revelarCpf = isDev

  // uma linha por ITEM (granularidade da faixa de cupons)
  const linhas = registros.flatMap((r) =>
    r.itens.map((it) => ({
      doador: r.doadorNome,
      cpf: cpfPorRole(r.doadorCpf, revelarCpf),
      local: r.local?.nome ?? '—',
      show: labelShow(it.showDia),
      alimento: it.alimento.product.name,
      qtd: it.quantidade,
      faixa: `${it.numeroInicio}–${it.numeroFim}`,
      operador: r.operador?.name ?? r.operador?.email ?? '—',
      data: r.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    })),
  )

  const totalCupons = linhas.reduce((a, l) => a + l.qtd, 0)

  // totais por show
  const porShow = new Map<string, number>()
  for (const r of registros) {
    for (const it of r.itens) {
      porShow.set(it.showDia, (porShow.get(it.showDia) ?? 0) + it.quantidade)
    }
  }

  // shows fora do line-up fixo não somem do relatório
  const showsExtras = [...porShow.keys()].filter(
    (k) => !SHOWS.some((s) => s.value === k),
  )
  const linhasResumo: [string, number][] = [
    ...SHOWS.map(
      (s) => [labelShow(s.value), porShow.get(s.value) ?? 0] as [string, number],
    ),
    ...showsExtras.map((k) => [labelShow(k), porShow.get(k) ?? 0] as [string, number]),
  ]

  const temFiltro = Boolean(inicioParam || fimParam)
  const periodoTxt = temFiltro
    ? `${inicioParam ? fmtBR(inicioParam) : 'início'} a ${fimParam ? fmtBR(fimParam) : 'hoje'}`
    : 'Todo o período do evento'

  const slug = evento.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40)
  const baseNome = `annonae-arrecadacao-extra-${slug || eventoId}`

  // ═══════════════════════ CSV ═══════════════════════
  if (formato === 'csv') {
    const sep = ';' // padrão Excel pt-BR
    const head = COLUNAS.map(csvCell).join(sep)
    const body = linhas
      .map((l) =>
        [
          csvCell(l.doador),
          csvCell(l.cpf),
          csvCell(l.local),
          csvCell(l.show),
          csvCell(l.alimento),
          csvCell(String(l.qtd)),
          csvCell(l.faixa),
          csvCell(l.operador),
          csvCell(l.data),
        ].join(sep),
      )
      .join('\r\n')

    // 🔤 BOM UTF-8 — sem ele o Excel-BR estraga acentuação
    const csv = `\uFEFF${head}\r\n${body}${body ? '\r\n' : ''}`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseNome}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ═══════════════════════ XLSX (exceljs) ═══════════════════════
  if (formato === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    wb.creator = BRANDING.name
    wb.created = new Date()

    // ── aba Resumo ──
    const wsResumo = wb.addWorksheet('Resumo')
    wsResumo.columns = [
      { header: 'Show', key: 'show', width: 30 },
      { header: 'Cupons', key: 'qtd', width: 12 },
    ]
    for (const [nome, qtd] of linhasResumo) wsResumo.addRow({ show: nome, qtd })
    const rowTotal = wsResumo.addRow({ show: 'TOTAL', qtd: totalCupons })
    rowTotal.font = { bold: true }
    rowTotal.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
    })

    // ── aba Registros ──
    const wsReg = wb.addWorksheet('Registros')
    wsReg.columns = [
      { header: 'Doador', key: 'doador', width: 28 },
      { header: 'CPF', key: 'cpf', width: 18 },
      { header: 'Local', key: 'local', width: 22 },
      { header: 'Show', key: 'show', width: 26 },
      { header: 'Alimento', key: 'alimento', width: 20 },
      { header: 'Cupons', key: 'qtd', width: 9 },
      { header: 'Faixa', key: 'faixa', width: 14 },
      { header: 'Operador', key: 'operador', width: 22 },
      { header: 'Data/Hora', key: 'data', width: 20 },
    ]

    for (const l of linhas) {
      const row = wsReg.addRow(l)
      // CPF e Faixa como TEXTO (preserva zero à esquerda e o "–")
      row.getCell('cpf').numFmt = '@'
      row.getCell('faixa').numFmt = '@'
      row.getCell('qtd').alignment = { horizontal: 'right' }
    }

    // cabeçalhos institucionais nas duas abas
    for (const ws of [wsResumo, wsReg]) {
      const head = ws.getRow(1)
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX_VERDE } }
      head.alignment = { vertical: 'middle' }
      head.height = 20
      head.eachCell((c) => {
        c.border = { bottom: { style: 'thin', color: { argb: HEX_OURO } } }
      })
      ws.views = [{ state: 'frozen', ySplit: 1 }]
    }

    // autofiltro na aba de registros
    if (linhas.length > 0) {
      wsReg.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: COLUNAS.length },
      }
    }

    const buf = await wb.xlsx.writeBuffer()

    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseNome}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ═══════════════════════ PDF ═══════════════════════
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGEM * 2

  // ── cabeçalho institucional ──
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, pageW, 88, 'F')

  const logo = carregarLogo()
  let textoX = MARGEM
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', MARGEM, 18, 52, 52)
      textoX = MARGEM + 66
    } catch {
      /* segue sem logo */
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text(BRANDING.name, textoX, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(226, 232, 226)
  doc.text('Arrecadação Extra — Registro de Cupons', textoX, 56)
  doc.setFontSize(7.5)
  doc.text(BRANDING.tagline, textoX, 68)

  doc.setFillColor(...OURO)
  doc.rect(0, 88, pageW, 3, 'F')

  let y = 114

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(25, 25, 25)
  const nomeLinhas = doc.splitTextToSize(evento.nome, contentW)
  doc.text(nomeLinhas, MARGEM, y)
  y += nomeLinhas.length * 17

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text(`Período: ${periodoTxt}  ·  Status: ${evento.status}`, MARGEM, y)
  y += 13
  doc.text(
    `Total de cupons: ${totalCupons}  ·  Registros: ${registros.length}  ·  Linhas: ${linhas.length}`,
    MARGEM,
    y,
  )
  y += 20

  // ── resumo por show ──
  autoTable(doc, {
    startY: y,
    head: [['Show', 'Cupons']],
    body: linhasResumo.map(([nome, qtd]) => [nome, String(qtd)]),
    foot: [['TOTAL', String(totalCupons)]],
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: VERDE, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 4 },
    columnStyles: { 1: { halign: 'right', cellWidth: 70 } },
    margin: { left: MARGEM, right: MARGEM },
    tableWidth: 320,
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 22

  // ── registros detalhados ──
  autoTable(doc, {
    startY: y,
    head: [[...COLUNAS]],
    body:
      linhas.length > 0
        ? linhas.map((l) => [
            l.doador,
            l.cpf,
            l.local,
            l.show,
            l.alimento,
            String(l.qtd),
            l.faixa,
            l.operador,
            l.data,
          ])
        : [['— sem registros no período —', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
    columnStyles: {
      1: { cellWidth: 78 },
      5: { halign: 'right', cellWidth: 40 },
      6: { cellWidth: 58, halign: 'center' },
      8: { cellWidth: 84 },
    },
    margin: { left: MARGEM, right: MARGEM, bottom: 44 },
  })

  // ── rodapé em todas as páginas ──
  const totalPaginas = doc.getNumberOfPages()
  const geradoEm = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
  const selo = revelarCpf ? 'CPF completo (dev)' : 'CPF mascarado'

  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(...OURO)
    doc.setLineWidth(1)
    doc.line(MARGEM, pageH - 34, pageW - MARGEM, pageH - 34)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `${selo}  ·  Gerado em ${geradoEm} por ${nomeUsuario}  ·  ${BRANDING.name}`,
      MARGEM,
      pageH - 20,
    )
    doc.text(`${p}/${totalPaginas}`, pageW - MARGEM, pageH - 20, { align: 'right' })
  }

  const bytes = doc.output('arraybuffer')

  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${baseNome}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
