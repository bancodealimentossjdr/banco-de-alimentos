import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit, podeRegistrarNoEvento } from '@/lib/permissions'
import EventoDetalheClient from './EventoDetalheClient'

export const dynamic = 'force-dynamic'

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

  const session = await auth()
  const role = session?.user?.role
  const userId = session?.user?.id
  if (!role || !userId) redirect('/login')

  const podeGerenciar = canEdit(role, 'eventos')
  const isAdmin = podeGerenciar

  const evento = await prisma.evento.findUnique({
    where: { id },
    include: {
      locais: {
        orderBy: { createdAt: 'asc' },
        include: { _count: { select: { recebimentos: true } } },
      },
      alimentos: {
        orderBy: { ordem: 'asc' },
        include: {
          _count: { select: { recebimentos: true } },
          product: { select: { id: true, name: true, unit: true } },
        },
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
          alimentoId: true,
          alimento: {
            select: {
              id: true,
              product: { select: { id: true, name: true, unit: true } },
            },
          },
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

  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId: id, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  const podeRegistrar = podeRegistrarNoEvento(role, temVinculoAtivo)

  const usuariosVinculaveis = isAdmin
    ? (
        await prisma.user.findMany({
          where: { role: 'visualizador' },
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        })
      ).map((u) => ({
        id: u.id,
        nome: u.name,
        email: maskEmail(u.email),
      }))
    : []

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
  const kgPorTipoMap = new Map<string, number>()
  const kgPorDiaMap = new Map<string, number>()

  let totalKg = 0

  // 🆕 17.5-a — array de FATOS cru (base para filtragem por data no client)
  const fatos: {
    localNome: string
    tipo: string
    unidade: string
    dia: string
    quantidade: number
  }[] = []

  for (const r of evento.recebimentos) {
    totalKg += r.quantidade

    const ln = localNome.get(r.localId) ?? '—'
    kgPorLocalMap.set(ln, (kgPorLocalMap.get(ln) ?? 0) + r.quantidade)

    const tipo = r.alimento?.product?.name ?? 'Não informado'
    kgPorTipoMap.set(tipo, (kgPorTipoMap.get(tipo) ?? 0) + r.quantidade)

    const dia = r.createdAt.toISOString().slice(0, 10)
    kgPorDiaMap.set(dia, (kgPorDiaMap.get(dia) ?? 0) + r.quantidade)

    // 🆕 fato individual
    fatos.push({
      localNome: ln,
      tipo,
      unidade: r.unidade ?? r.alimento?.product?.unit ?? 'kg',
      dia,
      quantidade: r.quantidade,
    })
  }

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

  const metrics = {
    totalKg: round(totalKg),
    totalRefugoKg: round(totalRefugoKg),
    totalLiquidoKg: round(totalKg - totalRefugoKg),
    kgPorLocal,
    kgPorTipo,
    kgPorDia,
  }

  // ════════════ 🆕 17.5-a — RANGE do filtro de data ════════════
  // min = data de início do evento (travado)
  // max = dataFim (se houver) ou hoje
  // default = últimos 7 dias, sem estourar o min
  const hojeISO = new Date().toISOString().slice(0, 10)
  const inicioISO = evento.dataInicio.toISOString().slice(0, 10)
  const fimISO = evento.dataFim ? evento.dataFim.toISOString().slice(0, 10) : hojeISO
  const max = fimISO < hojeISO ? fimISO : hojeISO

  // default start = 7 dias antes do max, mas nunca antes do início do evento
  const d = new Date(`${max}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 6)
  const seteDiasISO = d.toISOString().slice(0, 10)
  const defaultStart = seteDiasISO < inicioISO ? inicioISO : seteDiasISO

  const range = {
    min: inicioISO,
    max,
    defaultStart,
    defaultEnd: max,
  }

  // ════════════ AGREGAÇÃO DE DOAÇÕES ════════════
  type ProdAcc = Map<string, { nome: string; unidade: string; quantidade: number }>

  const porLocalAcc = new Map<
    string,
    { id: string; nome: string; produtos: ProdAcc }
  >()
  const totalGeralMap = new Map<string, number>()

  for (const r of evento.recebimentos) {
    const localId = r.localId
    const localNm = localNome.get(localId) ?? '—'
    const nomeProd = r.alimento?.product?.name ?? 'Não informado'
    const unidade = r.unidade ?? r.alimento?.product?.unit ?? 'kg'
    const qtd = r.quantidade

    if (!porLocalAcc.has(localId)) {
      porLocalAcc.set(localId, { id: localId, nome: localNm, produtos: new Map() })
    }
    const localEntry = porLocalAcc.get(localId)!
    const prodKey = `${nomeProd}__${unidade}`
    const prodEntry = localEntry.produtos.get(prodKey)
    if (prodEntry) {
      prodEntry.quantidade += qtd
    } else {
      localEntry.produtos.set(prodKey, { nome: nomeProd, unidade, quantidade: qtd })
    }

    totalGeralMap.set(unidade, (totalGeralMap.get(unidade) ?? 0) + qtd)
  }

  const doacoesPorLocal = [...porLocalAcc.values()].map((local) => {
    const produtos = [...local.produtos.values()]
      .map((p) => ({ ...p, quantidade: round(p.quantidade) }))
      .sort((a, b) => b.quantidade - a.quantidade)

    const subMap = new Map<string, number>()
    for (const p of produtos) {
      subMap.set(p.unidade, (subMap.get(p.unidade) ?? 0) + p.quantidade)
    }
    const subtotais = [...subMap.entries()]
      .map(([unidade, quantidade]) => ({ unidade, quantidade: round(quantidade) }))
      .sort((a, b) => a.unidade.localeCompare(b.unidade))

    return { id: local.id, nome: local.nome, produtos, subtotais }
  })

  const totalGeral = [...totalGeralMap.entries()]
    .map(([unidade, quantidade]) => ({ unidade, quantidade: round(quantidade) }))
    .sort((a, b) => a.unidade.localeCompare(b.unidade))

  const doacoes = {
    porLocal: doacoesPorLocal,
    totalGeral,
  }

  const eventoView = {
    id: evento.id,
    nome: evento.nome,
    descricao: evento.descricao,
    dataInicio: evento.dataInicio.toISOString(),
    dataFim: evento.dataFim ? evento.dataFim.toISOString() : null,
    status: evento.status,
    integraEstoque: evento.integraEstoque,
    obsRefugo: evento.obsRefugo,
    encerradoEm: evento.encerradoEm ? evento.encerradoEm.toISOString() : null,
    encerradoPor: evento.encerradoPor,
    criadoPor: evento.criadoPor,
    locais: evento.locais.map((l) => ({
      id: l.id,
      nome: l.nome,
      endereco: l.endereco,
      recebimentos: l._count.recebimentos,
    })),
    alimentos: evento.alimentos.map((a) => ({
      id: a.id,
      productId: a.productId,
      nome: a.product.name,
      unit: a.product.unit,
      ordem: a.ordem,
      refugoKg: a.refugoKg ?? 0,
      recebimentos: a._count.recebimentos,
    })),
    operadores: operadoresView,
    counts: {
      recebimentos: evento._count.recebimentos,
      locais: evento._count.locais,
      operadores: evento._count.operadores,
      alimentos: evento._count.alimentos,
    },
    metrics,
    fatos, // 🆕 17.5-a
    range, // 🆕 17.5-a
    doacoes,
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto w-full overflow-x-hidden">
      <EventoDetalheClient
        evento={eventoView}
        podeGerenciar={podeGerenciar}
        podeRegistrar={podeRegistrar}
        isAdmin={isAdmin}
        usuariosVinculaveis={usuariosVinculaveis}
      />
    </div>
  )
}

/** 🎭 Mascara email no server */
function maskEmail(email: string | null): string {
  if (!email) return '—'
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const visible = user.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`
}
