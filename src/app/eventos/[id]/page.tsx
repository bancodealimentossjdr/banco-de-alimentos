import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit, canRegisterRecebimento } from '@/lib/permissions'
import EventoDetalheClient from './EventoDetalheClient'

export const dynamic = 'force-dynamic'

// 🎭 Shape do operador quando a query incluiu a relação user (isAdmin)
type OperadorComUser = {
  id: string
  ativo: boolean
  user: { id: string; name: string | null; email: string | null; role: string }
}

export default async function EventoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // 🔐 Guarda de acesso server-side (defesa em profundidade)
  const session = await auth()
  const role = session?.user?.role
  if (!role) redirect('/login')

  const podeGerenciar = canEdit(role, 'eventos') // só admin
  const podeRegistrar = canRegisterRecebimento(role) // operador
  const isAdmin = podeGerenciar

  // 🔎 Busca o evento + recebimentos + alimentos (gráficos)
  const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
      locais: {
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { recebimentos: true } } },
      },
      // 🆕 17.3 — alimentos do evento (com refugo)
      alimentos: {
        orderBy: { ordem: 'asc' },
        include: { _count: { select: { recebimentos: true } } },
      },
      criadoPor: { select: { id: true, name: true } },
      encerradoPor: { select: { id: true, name: true } },
      operadores: isAdmin
        ? {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          }
        : false,
      recebimentos: {
        select: {
          id: true,
          // 🔄 17.3 — agora referência, não texto livre
          alimentoId: true,
          alimento: { select: { id: true, nome: true } },
          quantidade: true,
          unidade: true,
          localId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { recebimentos: true, operadores: true, locais: true, alimentos: true },
      },
    },
  })

  if (!evento) notFound()

  // 🎭 Operadores: SÓ existem na resposta se for admin.
  // O include condicional (isAdmin ? {...} : false) faz o TS perder o tipo
  // da relação `user`; por isso narrowing explícito aqui.
  const operadoresView =
    isAdmin && evento.operadores
      ? (evento.operadores as unknown as OperadorComUser[]).map((eo) => ({
          id: eo.id,
          ativo: eo.ativo,
          userId: eo.user.id,
          nome: eo.user.name,
          email: maskEmail(eo.user.email),
          role: eo.user.role,
        }))
      : []

  // ════════════ AGREGAÇÕES (server-side) p/ gráficos ════════════
  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))

  const kgPorLocalMap = new Map<string, number>()
  const kgPorTipoMap = new Map<string, number>() // 🔄 agora por alimento.nome
  const kgPorDiaMap = new Map<string, number>()

  let totalKg = 0

  for (const r of evento.recebimentos) {
    totalKg += r.quantidade

    // por local
    const ln = localNome.get(r.localId) ?? '—'
    kgPorLocalMap.set(ln, (kgPorLocalMap.get(ln) ?? 0) + r.quantidade)

    // 🔄 17.3 — por alimento (nome da relação, sem normalização frágil)
    const tipo = r.alimento?.nome ?? 'Não informado'
    kgPorTipoMap.set(tipo, (kgPorTipoMap.get(tipo) ?? 0) + r.quantidade)

    // por dia (YYYY-MM-DD)
    const dia = r.createdAt.toISOString().slice(0, 10)
    kgPorDiaMap.set(dia, (kgPorDiaMap.get(dia) ?? 0) + r.quantidade)
  }

  // 🆕 17.3 — refugo total vem dos ALIMENTOS (preenchido no pós-evento)
  const totalRefugoKg = evento.alimentos.reduce((acc, a) => acc + (a.refugoKg ?? 0), 0)

  const round = (n: number) => Math.round(n * 100) / 100

  const kgPorLocal = [...kgPorLocalMap.entries()]
    .map(([nome, kg]) => ({ nome, kg: round(kg) }))
    .sort((a, b) => b.kg - a.kg)

  const kgPorTipo = [...kgPorTipoMap.entries()]
    .map(([tipo, kg]) => ({ tipo, kg: round(kg) }))
    .sort((a, b) => b.kg - a.kg)

  const kgPorDia = [...kgPorDiaMap.entries()]
    .map(([dia, kg]) => ({ dia, kg: round(kg) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  // Serializa para o Client Component
  const eventoView = {
    id: evento.id,
    nome: evento.nome,
    descricao: evento.descricao,
    dataInicio: evento.dataInicio.toISOString(),
    dataFim: evento.dataFim ? evento.dataFim.toISOString() : null,
    status: evento.status,
    integraEstoque: evento.integraEstoque,
    encerradoEm: evento.encerradoEm ? evento.encerradoEm.toISOString() : null,
    encerradoPor: evento.encerradoPor,
    criadoPor: evento.criadoPor,
    locais: evento.locais.map((l) => ({
      id: l.id,
      nome: l.nome,
      endereco: l.endereco,
      recebimentos: l._count.recebimentos,
    })),
    // 🆕 17.3 — alimentos serializados (p/ tela de refugo + campo)
    alimentos: evento.alimentos.map((a) => ({
      id: a.id,
      nome: a.nome,
      ordem: a.ordem,
      refugoKg: a.refugoKg ?? 0,
      motivoRefugo: a.motivoRefugo,
      obsRefugo: a.obsRefugo,
      recebimentos: a._count.recebimentos,
    })),
    operadores: operadoresView,
    counts: {
      recebimentos: evento._count.recebimentos,
      locais: evento._count.locais,
      operadores: evento._count.operadores,
      alimentos: evento._count.alimentos, // 🆕 17.3
    },
    metrics: {
      totalKg: round(totalKg),
      totalRefugoKg: round(totalRefugoKg),
      totalLiquidoKg: round(totalKg - totalRefugoKg),
      kgPorLocal,
      kgPorTipo,
      kgPorDia,
    },
  }

  return (
    <EventoDetalheClient
      evento={eventoView}
      podeGerenciar={podeGerenciar}
      podeRegistrar={podeRegistrar}
      isAdmin={isAdmin}
    />
  )
}

/** 🎭 Mascara email no server: vitor@gmail.com → vi***@gmail.com */
function maskEmail(email: string | null): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const visible = user.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}
