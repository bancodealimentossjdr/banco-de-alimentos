import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit, podeRegistrarNoEvento } from '@/lib/permissions'
import EventoDetalheClient from './EventoDetalheClient'

export const revalidate = 15

const TZ = 'America/Sao_Paulo'

/**
 * 🕐 CORREÇÃO CRÍTICA — agrupamento por dia no fuso de Brasília.
 *
 * `toISOString().slice(0,10)` agrupa em UTC. Como a Vercel roda em UTC,
 * qualquer recebimento após 21h BRT era contabilizado no DIA SEGUINTE.
 * Em evento de show (público chega à noite), isso deslocava o volume inteiro.
 *
 * `en-CA` produz YYYY-MM-DD, que é ordenável lexicograficamente.
 */
const fmtDiaBR = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const diaISO = (d: Date) => fmtDiaBR.format(d)

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
      // ⚡ ONDA 21.3 — select enxuto: só o necessário para agregar.
      recebimentos: {
        select: {
          quantidade: true,
          unidade: true,
          localId: true,
          createdAt: true,
          alimento: {
            select: { product: { select: { name: true, unit: true } } },
          },
        },
      },
      // 🆕 ONDA 21.6 — contagem de arrecadação extra (cupons)
      _count: {
        select: {
          recebimentos: true,
          operadores: true,
          locais: true,
          alimentos: true,
          arrecadacoesExtra: true,
        },
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

  /**
   * 🎟️ ONDA 21.6 — total de cupons emitidos por show.
   * Agregado no BANCO (groupBy), não em memória: não carrega os itens.
   */
  const cuponsPorShowRaw = await prisma.arrecadacaoItem.groupBy({
    by: ['showDia'],
    where: { arrecadacao: { eventoId: id } },
    _sum: { quantidade: true },
  })
  const cuponsPorShow = cuponsPorShowRaw
    .map((c) => ({ showDia: c.showDia, cupons: c._sum.quantidade ?? 0 }))
    .sort((a, b) => a.showDia.localeCompare(b.showDia))
  const totalCupons = cuponsPorShow.reduce((a, c) => a + c.cupons, 0)

  const usuariosVinculaveis = isAdmin
    ? (
        await prisma.user.findMany({
          where: { role: 'visualizador', active: true },
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

  const round = (n: number) => Math.round(n * 100) / 100
  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))

  // ════════════════════════════════════════════════════════════════
  // ⚡ ONDA 21.3 — LOOP ÚNICO (1 varredura, todos os acumuladores)
  // ════════════════════════════════════════════════════════════════

  const kgPorLocalMap = new Map<string, number>()
  const kgPorTipoMap = new Map<string, number>()
  const kgPorDiaMap = new Map<string, number>()
  let totalKg = 0

  // 🔥 fatos AGREGADOS por (dia | localNome | tipo | unidade)
  const fatosMap = new Map<
    string,
    {
      localNome: string
      tipo: string
      unidade: string
      dia: string
      quantidade: number
    }
  >()

  type ProdAcc = Map<string, { nome: string; unidade: string; quantidade: number }>
  const porLocalAcc = new Map<
    string,
    { id: string; nome: string; produtos: ProdAcc }
  >()
  const totalGeralMap = new Map<string, number>()

  for (const r of evento.recebimentos) {
    const prod = r.alimento?.product
    const ln = localNome.get(r.localId) ?? '—'
    const tipo = prod?.name ?? 'Não informado'
    const unidade = r.unidade ?? prod?.unit ?? 'kg'
    const dia = diaISO(r.createdAt) // 🕐 fuso de Brasília
    const qtd = r.quantidade

    // — métricas globais —
    totalKg += qtd
    kgPorLocalMap.set(ln, (kgPorLocalMap.get(ln) ?? 0) + qtd)
    kgPorTipoMap.set(tipo, (kgPorTipoMap.get(tipo) ?? 0) + qtd)
    kgPorDiaMap.set(dia, (kgPorDiaMap.get(dia) ?? 0) + qtd)

    // — fatos agregados —
    const fatoKey = `${dia}|${ln}|${tipo}|${unidade}`
    const fato = fatosMap.get(fatoKey)
    if (fato) {
      fato.quantidade += qtd
    } else {
      fatosMap.set(fatoKey, { localNome: ln, tipo, unidade, dia, quantidade: qtd })
    }

    // — aba Doações —
    let localEntry = porLocalAcc.get(r.localId)
    if (!localEntry) {
      localEntry = { id: r.localId, nome: ln, produtos: new Map() }
      porLocalAcc.set(r.localId, localEntry)
    }
    const prodKey = `${tipo}__${unidade}`
    const prodEntry = localEntry.produtos.get(prodKey)
    if (prodEntry) {
      prodEntry.quantidade += qtd
    } else {
      localEntry.produtos.set(prodKey, { nome: tipo, unidade, quantidade: qtd })
    }

    totalGeralMap.set(unidade, (totalGeralMap.get(unidade) ?? 0) + qtd)
  }

  // 🔥 arredonda na saída (evita drift de float acumulado no loop)
  const fatos = [...fatosMap.values()]
    .map((f) => ({ ...f, quantidade: round(f.quantidade) }))
    .sort((a, b) => a.dia.localeCompare(b.dia))

  const totalRefugoKg = evento.alimentos.reduce(
    (acc, a) => acc + (a.refugoKg ?? 0),
    0,
  )

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

  // ════════════ RANGE do filtro de data (17.5-a) ════════════
  // 🕐 também no fuso BR: em UTC, das 21h à meia-noite "hoje" virava amanhã
  // e o input date recebia um max no futuro.
  const hojeISO = diaISO(new Date())
  const inicioISO = diaISO(evento.dataInicio)
  const fimISO = evento.dataFim ? diaISO(evento.dataFim) : hojeISO
  const max = fimISO < hojeISO ? fimISO : hojeISO

  // 7 dias para trás a partir de `max`
  const d = new Date(`${max}T12:00:00Z`) // meio-dia: imune a DST
  d.setUTCDate(d.getUTCDate() - 6)
  const seteDiasISO = d.toISOString().slice(0, 10)

  // ✅ guarda: evento futuro (max < inicioISO) não gera range invertido
  const defaultStart = seteDiasISO < inicioISO ? inicioISO : seteDiasISO
  const rangeMin = inicioISO <= max ? inicioISO : max

  const range = {
    min: rangeMin,
    max,
    defaultStart: defaultStart <= max ? defaultStart : max,
    defaultEnd: max,
  }

  // ════════════ SAÍDA da aba Doações ════════════
  const doacoesPorLocal = [...porLocalAcc.values()]
    .map((local) => {
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
    // ✅ ordena locais por volume (antes vinha na ordem aleatória do Map)
    .sort((a, b) => {
      const sa = a.subtotais.reduce((x, s) => x + s.quantidade, 0)
      const sb = b.subtotais.reduce((x, s) => x + s.quantidade, 0)
      return sb - sa
    })

  const totalGeral = [...totalGeralMap.entries()]
    .map(([unidade, quantidade]) => ({ unidade, quantidade: round(quantidade) }))
    .sort((a, b) => a.unidade.localeCompare(b.unidade))

  const doacoes = { porLocal: doacoesPorLocal, totalGeral }

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
      arrecadacoesExtra: evento._count.arrecadacoesExtra, // 🆕
    },
    metrics,
    fatos,
    range,
    doacoes,
    // 🆕 ONDA 21.6 — cupons de arrecadação extra
    cupons: { total: totalCupons, porShow: cuponsPorShow },
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
