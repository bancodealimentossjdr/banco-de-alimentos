import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// jspdf precisa de runtime Node (não Edge)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function maskEmail(email: string | null): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const session = await auth()
  const role = session?.user?.role
  if (!role) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const isAdmin = canEdit(role, 'eventos')

  // 🔐 Backend NÃO confia no frontend: só admin pode mask=false.
  const querMask = req.nextUrl.searchParams.get('mask')
  const semCensura = isAdmin && querMask === 'false'

  const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
      locais: {
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { recebimentos: true } } },
      },
      criadoPor: { select: { name: true } },
      // ✅ Sempre inclui o user (3 campos, leve). Exibição controlada por isAdmin.
      operadores: {
        include: { user: { select: { name: true, email: true, role: true } } },
      },
      // 🆕 17.3 — refugo vive no alimento, não no recebimento
      alimentos: {
        select: { refugoKg: true },
      },
      // 🆕 17.3 — recebimento não tem mais descricao/qtdRefugo
      recebimentos: {
        select: { quantidade: true, localId: true },
      },
    },
  })

  if (!evento) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // ─── Agregações ───
  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))
  const porLocal = new Map<string, number>()
  let totalKg = 0
  for (const r of evento.recebimentos) {
    totalKg += r.quantidade
    const ln = localNome.get(r.localId) ?? '—'
    porLocal.set(ln, (porLocal.get(ln) ?? 0) + r.quantidade)
  }
  // 🆕 17.3 — refugo somado a partir dos alimentos
  const refugoKg = evento.alimentos.reduce((acc, a) => acc + (a.refugoKg ?? 0), 0)

  const round = (n: number) => Math.round(n * 100) / 100
  const fmtKg = (n: number) =>
    `${round(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`

  // ─── Monta o PDF (jsPDF) ───
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const verde: [number, number, number] = [34, 140, 82]
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 48

  // Cabeçalho
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...verde)
  doc.text('Relatório do Evento de Arrecadação', 40, y)
  y += 26

  doc.setFontSize(14)
  doc.setTextColor(20, 20, 20)
  doc.text(evento.nome, 40, y)
  y += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text(`Status: ${evento.status}`, 40, y)
  y += 14
  if (evento.criadoPor) {
    doc.text(`Criado por: ${evento.criadoPor.name}`, 40, y)
    y += 14
  }
  y += 8

  // Resumo
  autoTable(doc, {
    startY: y,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total recebido', fmtKg(totalKg)],
      ['Refugo', fmtKg(refugoKg)],
      ['Líquido (sem refugo)', fmtKg(totalKg - refugoKg)],
      ['Recebimentos', String(evento.recebimentos.length)],
      ['Locais', String(evento.locais.length)],
    ],
    theme: 'striped',
    headStyles: { fillColor: verde },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 24

  // Quantidade por local
  const locaisBody = [...porLocal.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([nome, kg]) => [nome, fmtKg(kg)])

  autoTable(doc, {
    startY: y,
    head: [['Local de coleta', 'Recebido']],
    body: locaisBody.length > 0 ? locaisBody : [['— sem recebimentos —', '']],
    theme: 'grid',
    headStyles: { fillColor: verde },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  })
  // @ts-expect-error lastAutoTable é injetado pelo plugin
  y = doc.lastAutoTable.finalY + 24

  // 🎭 Operadores: só no PDF do admin; mascarado salvo "sem censura"
  if (isAdmin && evento.operadores) {
    const opBody = evento.operadores.map((op) => [
      op.user.name ?? '—',
      semCensura ? (op.user.email ?? '—') : maskEmail(op.user.email),
      op.user.role,
    ])

    autoTable(doc, {
      startY: y,
      head: [['Operador', 'E-mail', 'Perfil']],
      body: opBody.length > 0 ? opBody : [['— nenhum —', '', '']],
      theme: 'striped',
      headStyles: { fillColor: verde },
      styles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    })
  }

  // Rodapé
  const tag = semCensura ? 'DADOS SEM CENSURA (admin)' : 'Dados sensíveis mascarados'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `${tag} — gerado em ${new Date().toLocaleString('pt-BR')} — by Annonae`,
    40,
    pageHeight - 24,
  )

  const bytes = doc.output('arraybuffer')

  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="banco-de-alimentos-evento-${id}-by-annonae.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
