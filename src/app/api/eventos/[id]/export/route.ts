// src/app/api/eventos/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BRANDING } from '@/lib/branding'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// jspdf precisa de runtime Node (não Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─────────────── paleta institucional (hex → rgb) ───────────────
const VERDE: [number, number, number] = [20, 83, 45] // #14532D
const VERDE_CLARO: [number, number, number] = [22, 101, 52] // #166534
const OURO: [number, number, number] = [201, 162, 39] // #C9A227
const OURO_SUAVE: [number, number, number] = [250, 243, 219]
const CINZA: [number, number, number] = [110, 110, 110]
const CINZA_CLARO: [number, number, number] = [215, 215, 215]

const MARGEM = 40

const round = (n: number) => Math.round(n * 100) / 100
const fmtKg = (n: number) =>
  `${round(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
const fmtNum = (n: number) =>
  round(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const fmtBR = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * 🖼️ Logo institucional em base64.
 * Falha é silenciosa: o PDF sai sem logo, nunca quebra.
 */
function carregarLogo(): string | null {
  try {
    const caminho = join(process.cwd(), 'public', 'logos', 'annonae-color.png')
    return `data:image/png;base64,${readFileSync(caminho).toString('base64')}`
  } catch {
    return null
  }
}

/**
 * 📈 ONDA 21.4 — gráfico de linha temporal com PRIMITIVAS do jsPDF.
 * Sem canvas, sem chartjs-node-canvas. Vetorial, zero dependência nova.
 */
function desenharTimeline(
  doc: jsPDF,
  serie: { dia: string; kg: number }[],
  x: number,
  y: number,
  largura: number,
  altura: number,
) {
  const padL = 52
  const padB = 26
  const padT = 10
  const plotX = x + padL
  const plotY = y + padT
  const plotW = largura - padL - 8
  const plotH = altura - padT - padB
  const baseY = plotY + plotH

  const maxKg = Math.max(...serie.map((s) => s.kg), 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxKg)))
  const topo = Math.ceil(maxKg / magnitude) * magnitude

  const LINHAS = 4
  doc.setFontSize(7)
  doc.setTextColor(...CINZA)
  doc.setLineWidth(0.4)
  for (let i = 0; i <= LINHAS; i++) {
    const gy = baseY - (plotH * i) / LINHAS
    doc.setDrawColor(...CINZA_CLARO)
    doc.line(plotX, gy, plotX + plotW, gy)
    const valor = (topo * i) / LINHAS
    doc.text(fmtNum(valor), plotX - 6, gy + 2.5, { align: 'right' })
  }

  doc.setDrawColor(...CINZA)
  doc.setLineWidth(0.8)
  doc.line(plotX, plotY, plotX, baseY) // Y
  doc.line(plotX, baseY, plotX + plotW, baseY) // X

  const n = serie.length
  const px = (i: number) =>
    n === 1 ? plotX + plotW / 2 : plotX + (plotW * i) / (n - 1)
  const py = (kg: number) => baseY - (plotH * kg) / topo

  // ── área sob a curva (tom claro simulando translucidez) ──
  if (n > 1) {
    doc.setFillColor(232, 244, 236)
    for (let i = 0; i < n - 1; i++) {
      const x1 = px(i)
      const y1 = py(serie[i].kg)
      const x2 = px(i + 1)
      const y2 = py(serie[i + 1].kg)
      // trapézio = 2 triângulos
      doc.triangle(x1, y1, x2, y2, x1, baseY, 'F')
      doc.triangle(x2, y2, x2, baseY, x1, baseY, 'F')
    }
  }

  doc.setDrawColor(...VERDE_CLARO)
  doc.setLineWidth(1.6)
  for (let i = 0; i < n - 1; i++) {
    doc.line(px(i), py(serie[i].kg), px(i + 1), py(serie[i + 1].kg))
  }

  doc.setFillColor(...VERDE)
  for (let i = 0; i < n; i++) {
    doc.circle(px(i), py(serie[i].kg), n > 40 ? 1 : 2.2, 'F')
  }

  const passo = Math.max(1, Math.ceil(n / 8))
  doc.setFontSize(7)
  doc.setTextColor(...CINZA)
  for (let i = 0; i < n; i += passo) {
    const [, m, d] = serie[i].dia.split('-')
    doc.text(`${d}/${m}`, px(i), baseY + 12, { align: 'center' })
  }
  if ((n - 1) % passo !== 0 && n > 1) {
    const [, m, d] = serie[n - 1].dia.split('-')
    doc.text(`${d}/${m}`, px(n - 1), baseY + 12, { align: 'center' })
  }

  doc.setFontSize(7)
  doc.setTextColor(...CINZA)
  doc.text('kg recebidos por dia', plotX, y + altura + 2)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const session = await auth()
  const role = session?.user?.role
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const nomeUsuario = session?.user?.name ?? session?.user?.email ?? '—'

  // ❌ ONDA 21.6 — parâmetro `mask` REMOVIDO.
  // A tabela de operadores saiu na 21.4; não sobrou dado sensível neste
  // relatório, então o flag "sem censura" virou código morto e foi eliminado
  // junto com o checkbox da UI. Dados de CPF vivem no relatório de
  // arrecadação extra, que tem gate próprio (dev = cru, admin = mascarado).

  // filtro de período (YYYY-MM-DD). Ausentes = tudo.
  const inicioParam = req.nextUrl.searchParams.get('inicio')
  const fimParam = req.nextUrl.searchParams.get('fim')
  const dtInicio = inicioParam ? new Date(`${inicioParam}T00:00:00.000Z`) : null
  const dtFim = fimParam ? new Date(`${fimParam}T23:59:59.999Z`) : null

  const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
      locais: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, nome: true },
      },
      alimentos: {
        orderBy: { ordem: 'asc' },
        select: {
          id: true,
          refugoKg: true,
          product: { select: { name: true, unit: true } },
        },
      },
      criadoPor: { select: { name: true } },
      recebimentos: {
        where:
          dtInicio || dtFim
            ? {
                createdAt: {
                  ...(dtInicio ? { gte: dtInicio } : {}),
                  ...(dtFim ? { lte: dtFim } : {}),
                },
              }
            : undefined,
        select: {
          quantidade: true,
          localId: true,
          alimentoId: true,
          createdAt: true,
        },
      },
    },
  })

  if (!evento) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))

  // ─── Agregações (loop único) ───
  const porLocal = new Map<string, number>()
  const porAlimentoId = new Map<string, number>()
  const porDia = new Map<string, number>()
  let totalKg = 0

  for (const r of evento.recebimentos) {
    totalKg += r.quantidade

    const ln = localNome.get(r.localId) ?? '—'
    porLocal.set(ln, (porLocal.get(ln) ?? 0) + r.quantidade)

    porAlimentoId.set(
      r.alimentoId,
      (porAlimentoId.get(r.alimentoId) ?? 0) + r.quantidade,
    )

    const dia = r.createdAt.toISOString().slice(0, 10)
    porDia.set(dia, (porDia.get(dia) ?? 0) + r.quantidade)
  }

  // ⚠️ refugo NÃO tem data: é sempre do evento inteiro
  const refugoKg = evento.alimentos.reduce((acc, a) => acc + (a.refugoKg ?? 0), 0)

  const locaisRank = [...porLocal.entries()]
    .map(([nome, kg]) => ({ nome, kg: round(kg) }))
    .sort((a, b) => b.kg - a.kg)

  const alimentosRank = evento.alimentos
    .map((a) => ({
      nome: a.product.name,
      unit: a.product.unit,
      recebido: round(porAlimentoId.get(a.id) ?? 0),
      refugo: round(a.refugoKg ?? 0),
    }))
    .sort((a, b) => b.recebido - a.recebido)

  const serieDias = [...porDia.entries()]
    .map(([dia, kg]) => ({ dia, kg: round(kg) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  const temFiltro = Boolean(inicioParam || fimParam)
  const periodoTxt = temFiltro
    ? `${inicioParam ? fmtBR(inicioParam) : 'início'} a ${fimParam ? fmtBR(fimParam) : 'hoje'}`
    : 'Todo o período do evento'

  // ══════════════════════ MONTAGEM DO PDF ══════════════════════
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGEM * 2

  // ─────── 1. CABEÇALHO INSTITUCIONAL ───────
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, pageW, 96, 'F')

  const logo = carregarLogo()
  let textoX = MARGEM
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', MARGEM, 20, 56, 56)
      textoX = MARGEM + 70
    } catch {
      /* logo inválida: segue sem ela */
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text(BRANDING.name, textoX, 44)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(226, 232, 226)
  doc.text('Relatório de Evento de Arrecadação', textoX, 58)

  doc.setFontSize(7.5)
  doc.text(BRANDING.tagline, textoX, 70)

  // faixa dourada divisória
  doc.setFillColor(...OURO)
  doc.rect(0, 96, pageW, 3, 'F')

  let y = 124

  // nome do evento
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(25, 25, 25)
  const nomeLinhas = doc.splitTextToSize(evento.nome, contentW)
  doc.text(nomeLinhas, MARGEM, y)
  y += nomeLinhas.length * 18 + 2

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...CINZA)
  doc.text(`Período do relatório: ${periodoTxt}`, MARGEM, y)
  y += 13
  doc.text(
    `Status: ${evento.status}${evento.criadoPor ? `  ·  Criado por: ${evento.criadoPor.name}` : ''}`,
    MARGEM,
    y,
  )
  y += 22

  // ─────── 2. INDICADORES ───────
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total recebido', fmtKg(totalKg)],
      [temFiltro ? 'Refugo (evento todo)' : 'Refugo', fmtKg(refugoKg)],
      ['Líquido (sem refugo)', fmtKg(totalKg - refugoKg)],
      ['Recebimentos', String(evento.recebimentos.length)],
      ['Locais', String(evento.locais.length)],
      ['Alimentos', String(evento.alimentos.length)],
    ],
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: MARGEM, right: MARGEM },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 26

  // ─────── 3. LOCAIS DE COLETA — completo, TOP 5 destacado ───────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...VERDE)
  doc.text('Locais de coleta', MARGEM, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  doc.text('(ordem decrescente — 5 maiores em destaque)', MARGEM + 92, y)
  y += 12

  autoTable(doc, {
    startY: y,
    head: [['#', 'Local', 'Recebido', '% do total']],
    body:
      locaisRank.length > 0
        ? locaisRank.map((l, i) => [
            `${i + 1}º`,
            l.nome,
            fmtKg(l.kg),
            totalKg > 0 ? `${((l.kg / totalKg) * 100).toFixed(1)}%` : '—',
          ])
        : [['—', 'sem recebimentos no período', '', '']],
    theme: 'grid',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      2: { halign: 'right', cellWidth: 90 },
      3: { halign: 'right', cellWidth: 66 },
    },
    margin: { left: MARGEM, right: MARGEM },
    // 🏅 TOP 5 em destaque (fundo dourado + negrito)
    didParseCell: (data) => {
      if (data.section !== 'body') return
      if (locaisRank.length === 0) return
      if (data.row.index < 5) {
        data.cell.styles.fillColor = OURO_SUAVE
        data.cell.styles.fontStyle = 'bold'
        if (data.row.index < 3) data.cell.styles.textColor = VERDE
      }
    },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 26

  // ─────── 4. GRÁFICO — linha temporal ───────
  const alturaGrafico = 190
  if (y + alturaGrafico + 40 > pageH - 50) {
    doc.addPage()
    y = 56
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...VERDE)
  doc.text('Evolução das doações', MARGEM, y)
  y += 14

  if (serieDias.length > 0) {
    doc.setDrawColor(...CINZA_CLARO)
    doc.setLineWidth(0.6)
    doc.roundedRect(MARGEM, y, contentW, alturaGrafico, 4, 4, 'S')
    desenharTimeline(doc, serieDias, MARGEM, y, contentW, alturaGrafico - 8)
    y += alturaGrafico + 26
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...CINZA)
    doc.text('Sem dados no período selecionado.', MARGEM, y + 12)
    y += 34
  }

  // ─────── 5. ALIMENTOS — completo, TOP 3 destacado ───────
  if (y + 90 > pageH - 50) {
    doc.addPage()
    y = 56
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...VERDE)
  doc.text('Alimentos arrecadados', MARGEM, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...CINZA)
  doc.text('(ordem decrescente — 3 maiores em destaque)', MARGEM + 118, y)
  y += 12

  autoTable(doc, {
    startY: y,
    head: [['#', 'Alimento', 'Un.', 'Recebido', 'Refugo']],
    body:
      alimentosRank.length > 0
        ? alimentosRank.map((a, i) => [
            `${i + 1}º`,
            a.nome,
            a.unit,
            fmtKg(a.recebido),
            a.refugo > 0 ? fmtKg(a.refugo) : '—',
          ])
        : [['—', 'sem alimentos cadastrados', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: VERDE, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 42, halign: 'center' },
      3: { halign: 'right', cellWidth: 84 },
      4: { halign: 'right', cellWidth: 74 },
    },
    margin: { left: MARGEM, right: MARGEM },
    // 🏅 TOP 3 em destaque
    didParseCell: (data) => {
      if (data.section !== 'body') return
      if (alimentosRank.length === 0) return
      if (data.row.index < 3) {
        data.cell.styles.fillColor = OURO_SUAVE
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.textColor = VERDE
      }
    },
  })

  // ─────── 6. RODAPÉ em todas as páginas ───────
  const totalPaginas = doc.getNumberOfPages()
  const geradoEm = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })

  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p)
    doc.setDrawColor(...OURO)
    doc.setLineWidth(1)
    doc.line(MARGEM, pageH - 38, pageW - MARGEM, pageH - 38)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(140, 140, 140)
    doc.text(
      `Gerado em ${geradoEm} por ${nomeUsuario}  ·  ${BRANDING.name}`,
      MARGEM,
      pageH - 24,
    )
    doc.text(`${p}/${totalPaginas}`, pageW - MARGEM, pageH - 24, { align: 'right' })
  }

  const bytes = doc.output('arraybuffer')
  const slug = evento.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 50)

  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="annonae-evento-${slug || id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
