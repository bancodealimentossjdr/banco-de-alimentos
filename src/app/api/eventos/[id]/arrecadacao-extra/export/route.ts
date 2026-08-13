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
const VINHO: [number, number, number] = [155, 44, 44]
const MARGEM = 34

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

function labelShowCurto(v: string): string {
  const s = SHOWS.find((x) => x.value === v)
  return s ? `${s.data} · ${s.artista}` : v
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

  // ═══════════════════════ 🏆 apuração de destaques ═══════════════════════
  type Destaque = { nome: string; cupons: number; locais: string[]; ts: number }

  /** soma por identidade (CPF > nome) dentro de um show */
  function apurar(doShow: Linha[]): { lideres: Destaque[]; empate: boolean } {
    const soma = new Map<string, Destaque>()
    for (const l of doShow) {
      const atual = soma.get(l.chave)
      if (atual) {
        atual.cupons += l.qtd
        if (!atual.locais.includes(l.local)) atual.locais.push(l.local)
        if (l.ts < atual.ts) {
          atual.ts = l.ts
          atual.nome = l.doadorMasc
        }
      } else {
        soma.set(l.chave, {
          nome: l.doadorMasc,
          cupons: l.qtd,
          locais: [l.local],
          ts: l.ts,
        })
      }
    }
    const ranking = [...soma.values()].sort((a, b) => b.cupons - a.cupons || a.ts - b.ts)
    if (ranking.length === 0) return { lideres: [], empate: false }
    const max = ranking[0].cupons
    const lideres = ranking.filter((d) => d.cupons === max)
    return { lideres, empate: lideres.length > 1 }
  }

  const destaquesPorShow = new Map<string, { lideres: Destaque[]; empate: boolean }>()
  for (const showDia of ordemShows) {
    destaquesPorShow.set(
      showDia,
      apurar(linhas.filter((l) => l.showDia === showDia)),
    )
  }

  // ═══════════════════════ PDF (retrato) ═══════════════════════
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGEM * 2

  const logo = carregarLogo()

  function cabecalho(): number {
    doc.setFillColor(...VERDE)
    doc.rect(0, 0, pageW, 76, 'F')

    let textoX = MARGEM
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', MARGEM, 14, 46, 46)
        textoX = MARGEM + 58
      } catch {
        /* segue sem logo */
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text(BRANDING.name, textoX, 36)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(226, 232, 226)
    doc.text('Conheça seu ídolo', textoX, 49)
    doc.setFontSize(7)
    doc.text(BRANDING.tagline, textoX, 60)

    doc.setFillColor(...OURO)
    doc.rect(0, 76, pageW, 3, 'F')

    return 100
  }

  /** 🏆 card único de destaques — grid: show / nome / local / cupons */
  function cardDestaques(
    yTop: number,
    titulo: string,
    itens: { rotulo: string; lideres: Destaque[]; empate: boolean }[],
  ): number {
    const padX = 12
    const x0 = MARGEM + padX
    const xNome = x0
    const wNome = 200
    const xLocal = x0 + wNome + 10
    const wLocal = 190
    const xCupons = pageW - MARGEM - padX

    const HEAD = 22 // faixa do título
    const FAIXA = 16 // faixa de cada show
    const LINHA = 15 // linha de doador

    const alturaBloco = (it: (typeof itens)[number]) =>
      FAIXA + Math.max(it.lideres.length, 1) * LINHA + 4

    const cardH = HEAD + 6 + itens.reduce((a, it) => a + alturaBloco(it), 0) + 6

    // moldura
    doc.setFillColor(252, 249, 235)
    doc.setDrawColor(...OURO)
    doc.setLineWidth(1.2)
    doc.roundedRect(MARGEM, yTop, contentW, cardH, 5, 5, 'FD')

    // faixa de título
    doc.setFillColor(...OURO)
    doc.roundedRect(MARGEM, yTop, contentW, HEAD, 5, 5, 'F')
    doc.rect(MARGEM, yTop + HEAD - 8, contentW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(titulo, x0, yTop + 14.5)

    let cy = yTop + HEAD + 6

    for (const it of itens) {
      // ── faixa do show ──
      doc.setFillColor(238, 243, 238)
      doc.rect(MARGEM + 1, cy, contentW - 2, FAIXA, 'F')

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...VERDE)
      doc.text(it.rotulo.toUpperCase(), x0, cy + 11)

      if (it.empate) {
        const txt = 'EMPATE — SORTEIO PRESENCIAL'
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.4)
        const wBadge = doc.getTextWidth(txt) + 12
        doc.setFillColor(...VINHO)
        doc.roundedRect(xCupons - wBadge, cy + 3, wBadge, 10.5, 3, 3, 'F')
        doc.setTextColor(255, 255, 255)
        doc.text(txt, xCupons - wBadge / 2, cy + 10.3, { align: 'center' })
      }

      cy += FAIXA + 3

      if (it.lideres.length === 0) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.setTextColor(...CINZA)
        doc.text('sem registros', xNome, cy + 9)
        cy += LINHA + 4
        continue
      }

      it.lideres.forEach((d, i) => {
        const baseY = cy + 10

        // nome (com índice quando houver sorteio)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(25, 25, 25)
        const nomeTxt = it.empate ? `${i + 1}.  ${d.nome}` : d.nome
        doc.text(
          doc.splitTextToSize(nomeTxt, wNome)[0] ?? nomeTxt,
          xNome,
          baseY,
        )

        // local
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        doc.setTextColor(...CINZA)
        const locaisTxt =
          d.locais.length > 1 ? `${d.locais.join(' · ')}` : (d.locais[0] ?? '—')
        doc.text(
          doc.splitTextToSize(locaisTxt, wLocal)[0] ?? locaisTxt,
          xLocal,
          baseY,
        )

        // cupons
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(...OURO)
        doc.text(`${d.cupons} cupons`, xCupons, baseY, { align: 'right' })

        cy += LINHA
      })

      cy += 4
    }

    return yTop + cardH + 14
  }

  // ─── página 1: capa + resumo + destaques ───
  let y = cabecalho()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(25, 25, 25)
  const nomeLinhas = doc.splitTextToSize(evento.nome, contentW)
  doc.text(nomeLinhas, MARGEM, y)
  y += nomeLinhas.length * 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...CINZA)
  doc.text(`Período: ${periodoTxt}  ·  Status: ${evento.status}`, MARGEM, y)
  y += 12
  doc.text(
    `Total de cupons: ${totalCupons}  ·  Registros: ${registros.length}  ·  Linhas: ${linhas.length}`,
    MARGEM,
    y,
  )
  y += 18

  autoTable(doc, {
    startY: y,
    head: [['Show', 'Cupons']],
    body: linhasResumo.map(([nome, qtd]) => [nome, String(qtd)]),
    foot: [['TOTAL', String(totalCupons)]],
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [245, 245, 245], textColor: VERDE, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 1: { halign: 'right', cellWidth: 70 } },
    margin: { left: MARGEM, right: MARGEM },
    tableWidth: contentW,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 20

  const itensDestaque = ordemShows.map((showDia) => {
    const d = destaquesPorShow.get(showDia) ?? { lideres: [], empate: false }
    return { rotulo: labelShowCurto(showDia), lideres: d.lideres, empate: d.empate }
  })

  if (itensDestaque.length > 0) {
    y = cardDestaques(y, 'NOMES EM DESTAQUE  ·  MAIORES DOADORES POR SHOW', itensDestaque)

    const temEmpate = itensDestaque.some((i) => i.empate)
    if (temEmpate) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(...VINHO)
      doc.text(
        'Nos casos de empate, o ganhador será definido por sorteio presencial entre os nomes listados.',
        MARGEM,
        y,
      )
      y += 14
    }
  }

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
    doc.setFontSize(14)
    doc.setTextColor(...VERDE)
    doc.text(labelShow(showDia), MARGEM, by)
    by += 15

    const totalShow = doShow.reduce((a, l) => a + l.qtd, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...CINZA)
    doc.text(
      `Total de cupons: ${totalShow}  ·  Linhas: ${doShow.length}  ·  Faixa: 1–${totalShow}`,
      MARGEM,
      by,
    )
    by += 14

    // 🚨 verificação de continuidade da numeração
    let esperado = 1
    const falhas: string[] = []
    for (const l of doShow) {
      if (l.ini !== esperado) falhas.push(`${esperado}→${l.ini}`)
      esperado = l.fim + 1
    }
    if (falhas.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(180, 40, 40)
      doc.text(
        doc.splitTextToSize(
          `ATENÇÃO: numeração descontínua (${falhas.slice(0, 6).join(', ')}${falhas.length > 6 ? '…' : ''}) — rode a renumeração.`,
          contentW,
        ),
        MARGEM,
        by,
      )
      by += 16
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
      headStyles: {
        fillColor: VERDE,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: isDev ? 6.2 : 7.5,
      },
      styles: {
        fontSize: isDev ? 5.8 : 7,
        cellPadding: isDev ? 1.8 : 2.6,
        overflow: 'linebreak',
      },
      columnStyles: isDev
        ? {
            0: { cellWidth: 88 },
            1: { cellWidth: 62 },
            2: { cellWidth: 70 },
            3: { cellWidth: 62 },
            4: { halign: 'right', cellWidth: 26 },
            5: { cellWidth: 44, halign: 'center' },
            6: { cellWidth: 38 },
            7: { cellWidth: 34 },
          }
        : {
            0: { cellWidth: 132 },
            1: { cellWidth: 106 },
            2: { cellWidth: 92 },
            3: { halign: 'right', cellWidth: 34 },
            4: { cellWidth: 56, halign: 'center' },
            5: { cellWidth: 47 },
          },
      margin: { left: MARGEM, right: MARGEM, bottom: 42 },
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
    doc.line(MARGEM, pageH - 32, pageW - MARGEM, pageH - 32)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `${selo}  ·  Gerado em ${geradoEm} por ${nomeUsuario}  ·  ${BRANDING.name}`,
      MARGEM,
      pageH - 19,
    )
    doc.text(`${p}/${totalPaginas}`, pageW - MARGEM, pageH - 19, { align: 'right' })
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
