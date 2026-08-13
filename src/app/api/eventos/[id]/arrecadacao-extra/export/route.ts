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

// ─── 🎭 máscara de sobrenome (LGPD-friendly p/ divulgação) ───
const CONECTORES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

function mascararNome(nome: string): string {
  const partes = nome.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (partes.length === 0) return '—'
  if (partes.length === 1) return capitalizar(partes[0])
  return [
    capitalizar(partes[0]),
    ...partes.slice(1).map((p) =>
      CONECTORES.has(p.toLowerCase()) ? p.toLowerCase() : `${p[0].toUpperCase()}.`,
    ),
  ].join(' ')
}

function capitalizar(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

/** chave de identidade: CPF normalizado; sem CPF → nome normalizado */
function chaveDoador(cpf: string | null, nome: string): string {
  const d = (cpf ?? '').replace(/\D/g, '')
  if (d.length > 0) return `cpf:${d}`
  return `nome:${nome.trim().toLowerCase().replace(/\s+/g, ' ')}`
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
  // 🔐 gate server-side: dev OU admin. Não exige evento ATIVO.
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

  const revelarCpf = isDev

  type Linha = {
    showDia: string
    doador: string
    doadorMasc: string
    cpf: string
    chave: string
    local: string
    show: string
    alimento: string
    qtd: number
    ini: number
    fim: number
    faixa: string
    operador: string
    dia: string
    hora: string
    data: string
    ts: number
  }

  const linhas: Linha[] = registros.flatMap((r) =>
    r.itens.map((it) => ({
      showDia: it.showDia,
      doador: r.doadorNome,
      doadorMasc: mascararNome(r.doadorNome),
      cpf: cpfPorRole(r.doadorCpf, revelarCpf),
      chave: chaveDoador(r.doadorCpf, r.doadorNome),
      local: r.local?.nome ?? '—',
      show: labelShow(it.showDia),
      alimento: it.alimento.product.name,
      qtd: it.quantidade,
      ini: it.numeroInicio,
      fim: it.numeroFim,
      faixa: `${it.numeroInicio}–${it.numeroFim}`,
      operador: r.operador?.name ?? r.operador?.email ?? '—',
      dia: r.createdAt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      hora: r.createdAt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      data: r.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      ts: r.createdAt.getTime(),
    })),
  )

  const totalCupons = linhas.reduce((a, l) => a + l.qtd, 0)

  const porShow = new Map<string, number>()
  for (const l of linhas) porShow.set(l.showDia, (porShow.get(l.showDia) ?? 0) + l.qtd)

  const showsExtras = [...porShow.keys()].filter((k) => !SHOWS.some((s) => s.value === k))
  const ordemShows: string[] = [
    ...SHOWS.map((s) => s.value).filter((v) => porShow.has(v)),
    ...showsExtras,
  ]
  const linhasResumo: [string, number][] = [
    ...SHOWS.map((s) => [labelShow(s.value), porShow.get(s.value) ?? 0] as [string, number]),
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
    const sep = ';'
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

  // ═══════════════════════ XLSX ═══════════════════════
  if (formato === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    wb.creator = BRANDING.name
    wb.created = new Date()

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
      row.getCell('cpf').numFmt = '@'
      row.getCell('faixa').numFmt = '@'
      row.getCell('qtd').alignment = { horizontal: 'right' }
    }

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

  const logo = carregarLogo()

  function cabecalho(): number {
    doc.setFillColor(...VERDE)
    doc.rect(0, 0, pageW, 88, 'F')

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
    doc.text('Conheça seu ídolo', textoX, 56)
    doc.setFontSize(7.5)
    doc.text(BRANDING.tagline, textoX, 68)

    doc.setFillColor(...OURO)
    doc.rect(0, 88, pageW, 3, 'F')

    return 114
  }

  // ─── página 1: capa + resumo ───
  let y = cabecalho()

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

  // ─── um bloco (página) por show ───
  const colunasPub = ['Doador', 'Local', 'Alimento', 'Cupons', 'Números', 'Data'] as const
  const colunasDev = [
    'Doador',
    'CPF',
    'Local',
    'Alimento',
    'Cupons',
    'Números',
    'Data',
    'Hora',
    'Operador',
  ] as const
  const cols: readonly string[] = isDev ? colunasDev : colunasPub

  for (const showDia of ordemShows) {
    const doShow = linhas
      .filter((l) => l.showDia === showDia)
      .sort((a, b) => a.ini - b.ini)
    if (doShow.length === 0) continue

    doc.addPage()
    let by = cabecalho()

    // título do bloco
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...VERDE)
    doc.text(labelShow(showDia), MARGEM, by)
    by += 16

    const totalShow = doShow.reduce((a, l) => a + l.qtd, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...CINZA)
    doc.text(
      `Total de cupons: ${totalShow}  ·  Linhas: ${doShow.length}  ·  Faixa: 1–${totalShow}`,
      MARGEM,
      by,
    )
    by += 16

    // 🚨 verificação de continuidade da numeração
    let esperado = 1
    const falhas: string[] = []
    for (const l of doShow) {
      if (l.ini !== esperado) falhas.push(`${esperado}→${l.ini}`)
      esperado = l.fim + 1
    }
    if (falhas.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(180, 40, 40)
      doc.text(
        `ATENÇÃO: numeração descontínua (${falhas.slice(0, 6).join(', ')}${falhas.length > 6 ? '…' : ''}) — rode a renumeração.`,
        MARGEM,
        by,
      )
      by += 16
    }

    // 🏆 card do maior doador do show
    const somaPorDoador = new Map<
      string,
      { nome: string; cupons: number; local: string; ts: number }
    >()
    for (const l of doShow) {
      const atual = somaPorDoador.get(l.chave)
      if (atual) {
        atual.cupons += l.qtd
        if (l.ts < atual.ts) {
          atual.ts = l.ts
          atual.nome = l.doadorMasc
          atual.local = l.local
        }
      } else {
        somaPorDoador.set(l.chave, {
          nome: l.doadorMasc,
          cupons: l.qtd,
          local: l.local,
          ts: l.ts,
        })
      }
    }
    const campeao = [...somaPorDoador.values()].sort(
      (a, b) => b.cupons - a.cupons || a.ts - b.ts,
    )[0]

    if (campeao) {
      const cardH = 46
      doc.setFillColor(252, 248, 232)
      doc.setDrawColor(...OURO)
      doc.setLineWidth(1.2)
      doc.rect(MARGEM, by, contentW, cardH, 'FD')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...OURO)
      doc.text(`MAIOR DOADOR  —  ${labelShow(showDia)}`, MARGEM + 12, by + 17)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(25, 25, 25)
      doc.text(
        `${campeao.nome}  ·  ${campeao.local}  ·  ${campeao.cupons} cupons`,
        MARGEM + 12,
        by + 34,
      )

      by += cardH + 16
    }

    autoTable(doc, {
      startY: by,
      head: [[...cols]],
      body: doShow.map((l) =>
        isDev
          ? [
              l.doadorMasc,
              l.cpf,
              l.local,
              l.alimento,
              String(l.qtd),
              l.faixa,
              l.dia,
              l.hora,
              l.operador,
            ]
          : [l.doadorMasc, l.local, l.alimento, String(l.qtd), l.faixa, l.dia],
      ),
      theme: 'grid',
      headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: isDev
        ? {
            1: { cellWidth: 78 },
            4: { halign: 'right', cellWidth: 40 },
            5: { cellWidth: 58, halign: 'center' },
            6: { cellWidth: 54 },
            7: { cellWidth: 46 },
          }
        : {
            3: { halign: 'right', cellWidth: 46 },
            4: { cellWidth: 70, halign: 'center' },
            5: { cellWidth: 62 },
          },
      margin: { left: MARGEM, right: MARGEM, bottom: 44 },
    })
  }

  // ── rodapé em todas as páginas ──
  const totalPaginas = doc.getNumberOfPages()
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const selo = revelarCpf ? 'CPF completo (dev)' : 'CPF oculto'

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
