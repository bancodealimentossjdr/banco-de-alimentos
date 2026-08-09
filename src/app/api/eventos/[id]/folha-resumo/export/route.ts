import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import * as XLSX from 'xlsx'

// xlsx precisa de runtime Node
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    data: r.createdAt.toLocaleString('pt-BR'),
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
    const csv = `\uFEFF${head}\r\n${body}\r\n`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseNome}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // ─────────────────────── XLSX ───────────────────────
  const aoa: (string | number)[][] = [
    [...COLUNAS],
    ...linhas.map((l) => [
      l.codigoFamiliar,
      l.cpf, // 👈 mantido como TEXTO (evita perder zero à esquerda)
      l.renda,
      l.show,
      l.operador,
      l.data,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // força CPF e código como texto + formato monetário na renda
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of [0, 1]) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })]
      if (cell) cell.t = 's'
    }
    const cellRenda = ws[XLSX.utils.encode_cell({ r: R, c: 2 })]
    if (cellRenda) cellRenda.z = '#,##0.00'
  }

  ws['!cols'] = [
    { wch: 20 }, // código
    { wch: 18 }, // cpf
    { wch: 20 }, // renda
    { wch: 26 }, // show
    { wch: 24 }, // operador
    { wch: 20 }, // data
  ]
  ws['!autofilter'] = { ref: ws['!ref'] ?? 'A1' }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Folha Resumo')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

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
