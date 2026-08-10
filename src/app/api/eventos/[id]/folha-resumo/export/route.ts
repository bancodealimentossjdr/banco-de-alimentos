import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import ExcelJS from 'exceljs'

// exceljs precisa de runtime Node
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEX_VERDE = 'FF14532D'
const HEX_OURO = 'FFC9A227'

// 🎤 Line-up FIXO — espelha o de ../route.ts
const SHOWS = [
  { value: 'hugo-guilherme-13', artista: 'Hugo e Guilherme', data: '13/08' },
  { value: 'ana-castela-14', artista: 'Ana Castela', data: '14/08' },
  { value: 'daniel-15', artista: 'Daniel', data: '15/08' },
  { value: 'mariana-fagundes-16', artista: 'Mariana Fagundes', data: '16/08' },
] as const

const SHOW_VALUES: Set<string> = new Set(SHOWS.map((s) => s.value))

function labelShow(v: string | null): string {
  if (!v) return '—'
  const s = SHOWS.find((x) => x.value === v)
  return s ? `${s.data} — ${s.artista}` : v
}

/** Formata CPF cru (11 dígitos) → 123.456.789-00 */
function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Escapa campo de CSV (RFC 4180) */
function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`
}

const COLUNAS = [
  'Código Familiar',
  'CPF',
  'Renda Per Capita (R$)',
  'Show',
  'Registrado por',
  'Data/Hora',
] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1️⃣ Autenticação
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  // 🔐 GATE DEV-ONLY — backend nunca confia no frontend.
  // ⚠️ LGPD: esta planilha carrega CPF CRU e sai do sistema.
  if (result.user.role !== 'dev') {
    return NextResponse.json(
      { error: 'Apenas o desenvolvedor pode exportar a folha resumo' },
      { status: 403 },
    )
  }

  const { id: eventoId } = await params

  const formato = (req.nextUrl.searchParams.get('format') ?? 'xlsx').toLowerCase()
  if (formato !== 'xlsx' && formato !== 'csv') {
    return NextResponse.json(
      { error: 'Formato inválido. Use xlsx ou csv.' },
      { status: 400 },
    )
  }

  // filtro opcional por show
  const showParam = req.nextUrl.searchParams.get('showDia')
  const showDia = showParam && SHOW_VALUES.has(showParam) ? showParam : null

  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, nome: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 🆕 SEM take — exporta TODOS os registros (era LIMITE_LISTA = 20)
  const registros = await prisma.folhaResumoIngresso.findMany({
    where: { eventoId, ...(showDia ? { showDia } : {}) },
    orderBy: { createdAt: 'asc' },
    select: {
      codigoFamiliar: true,
      cpf: true,
      rendaPerCapita: true,
      showDia: true,
      registradoPor: true,
      createdAt: true,
    },
  })

  // ⚠️ registradoPor é String (userId), NÃO relação → resolve nomes num mapa
  const idsOperadores = [...new Set(registros.map((r) => r.registradoPor))]
  const operadores = idsOperadores.length
    ? await prisma.user.findMany({
        where: { id: { in: idsOperadores } },
        select: { id: true, name: true, email: true },
      })
    : []
  const nomeOperador = new Map(
    operadores.map((u) => [u.id, u.name ?? u.email ?? u.id]),
  )

  const linhas = registros.map((r) => ({
    codigoFamiliar: r.codigoFamiliar,
    cpf: formatarCpf(r.cpf), // 🔓 CRU
    renda: Number(r.rendaPerCapita),
    show: labelShow(r.showDia),
    operador: nomeOperador.get(r.registradoPor) ?? r.registradoPor,
    // 🕐 fuso explícito: a Vercel roda em UTC, sem isso a hora sai 3h adiantada
    data: r.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  }))

  const slug = evento.nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40)
  const sufixo = showDia ? `-${showDia}` : ''
  const baseNome = `annonae-folha-resumo-${slug || eventoId}${sufixo}`

  // ─────────────────────── CSV ───────────────────────
  if (formato === 'csv') {
    const sep = ';' // Excel pt-BR usa ; como separador padrão
    const head = COLUNAS.map(csvCell).join(sep)
    const body = linhas
      .map((l) =>
        [
          csvCell(l.codigoFamiliar),
          csvCell(l.cpf),
          csvCell(l.renda.toFixed(2).replace('.', ',')), // decimal pt-BR
          csvCell(l.show),
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

  // ─────────────────────── XLSX (exceljs) ───────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Annonae'
  wb.created = new Date()

  const ws = wb.addWorksheet('Folha Resumo')
  ws.columns = [
    { header: COLUNAS[0], key: 'codigoFamiliar', width: 20 },
    { header: COLUNAS[1], key: 'cpf', width: 18 },
    { header: COLUNAS[2], key: 'renda', width: 20 },
    { header: COLUNAS[3], key: 'show', width: 26 },
    { header: COLUNAS[4], key: 'operador', width: 24 },
    { header: COLUNAS[5], key: 'data', width: 20 },
  ]

  // cabeçalho institucional
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.height = 20
  head.alignment = { vertical: 'middle' }
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEX_VERDE } }
    c.border = { bottom: { style: 'thin', color: { argb: HEX_OURO } } }
  })

  for (const l of linhas) {
    const row = ws.addRow(l)
    // 👇 código e CPF como TEXTO (preserva zero à esquerda)
    row.getCell('codigoFamiliar').numFmt = '@'
    row.getCell('cpf').numFmt = '@'
    row.getCell('renda').numFmt = '#,##0.00'
    row.getCell('renda').alignment = { horizontal: 'right' }
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }]
  if (linhas.length > 0) {
    ws.autoFilter = {
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
