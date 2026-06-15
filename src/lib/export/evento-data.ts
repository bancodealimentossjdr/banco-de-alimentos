import { prisma } from '@/lib/prisma'
import type { EventoExportData } from './evento-pdf'

// 🎭 Shape do operador quando a query incluiu a relação user (isAdmin)
// ⚠️ Aqui o select traz só name/email/role (sem id) — reflete a query deste arquivo.
type OperadorComUser = {
  id: string
  ativo: boolean
  user: { name: string | null; email: string | null; role: string }
}

/** 🎭 vitor@gmail.com → vi***@gmail.com */
function maskEmail(email: string | null): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}

export async function getEventoExportData(opts: {
  id: string
  isAdmin: boolean
  censurar: boolean
}): Promise<EventoExportData | null> {
  const { id, isAdmin, censurar } = opts

  const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
      locais: { orderBy: { createdAt: 'asc' } },
      // 🔄 17.4 — alimento traz o nome via product (catálogo)
      alimentos: {
        orderBy: { ordem: 'asc' },
        select: {
          id: true,
          refugoKg: true,
          motivoRefugo: true,
          product: { select: { id: true, name: true, unit: true } },
        },
      },
      criadoPor: { select: { name: true } },
      operadores: isAdmin
        ? { include: { user: { select: { name: true, email: true, role: true } } } }
        : false,
      // 🆕 17.3 — recebimento agora referencia alimentoId (sem qtdRefugo)
      recebimentos: { select: { quantidade: true, localId: true, alimentoId: true } },
    },
  })

  if (!evento) return null

  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))
  // 🔄 17.4 — nome do alimento vem do product
  const alimentoNome = new Map(evento.alimentos.map((a) => [a.id, a.product.name]))

  const porLocalMap = new Map<string, number>()
  const recebidoPorAlimento = new Map<string, number>() // alimentoId → kg
  let totalKg = 0

  for (const r of evento.recebimentos) {
    totalKg += r.quantidade

    // por local
    const ln = localNome.get(r.localId) ?? '—'
    porLocalMap.set(ln, (porLocalMap.get(ln) ?? 0) + r.quantidade)

    // 🆕 por alimento (agregação por alimentoId — correto)
    recebidoPorAlimento.set(
      r.alimentoId,
      (recebidoPorAlimento.get(r.alimentoId) ?? 0) + r.quantidade,
    )
  }

  // 🆕 17.3 — refugo agora vem do EventoAlimento (não mais do recebimento)
  const refugoKg = evento.alimentos.reduce((acc, a) => acc + (a.refugoKg ?? 0), 0)

  const round = (n: number) => Math.round(n * 100) / 100

  const porLocal = [...porLocalMap.entries()]
    .map(([nome, kg]) => ({ nome, kg: round(kg) }))
    .sort((a, b) => b.kg - a.kg)

  // 🆕 17.3 — recebido + refugo por alimento (ordem fixa da tela de campo)
  const porAlimento = evento.alimentos.map((a) => ({
    nome: a.product.name,
    recebidoKg: round(recebidoPorAlimento.get(a.id) ?? 0),
    refugoKg: round(a.refugoKg ?? 0),
    motivoRefugo: a.motivoRefugo ?? null,
  }))

  // 🔐 Operadores só existem no PDF do admin.
  const operadores =
    isAdmin && evento.operadores
      ? (evento.operadores as unknown as OperadorComUser[]).map((eo) => ({
          nome: eo.user.name ?? '—',
          email: censurar ? maskEmail(eo.user.email) : (eo.user.email ?? '—'),
          role: eo.user.role,
        }))
      : null

  return {
    nome: evento.nome,
    status: evento.status,
    criadoPor: evento.criadoPor?.name ?? null,
    totalKg: round(totalKg),
    refugoKg: round(refugoKg),
    liquidoKg: round(totalKg - refugoKg),
    totalRecebimentos: evento.recebimentos.length,
    totalLocais: evento.locais.length,
    totalAlimentos: evento.alimentos.length, // 🆕
    porLocal,
    porAlimento, // 🆕
    operadores,
    censurado: censurar,
  }
}
