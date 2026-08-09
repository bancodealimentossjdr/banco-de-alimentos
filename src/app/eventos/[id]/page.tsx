import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit, podeRegistrarNoEvento } from '@/lib/permissions'
import EventoDetalheClient from './EventoDetalheClient'

export const revalidate = 15

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
      // Removidos: id, alimentoId, alimento.id, product.id (não usados).
      // orderBy removido: a ordenação é feita nos arrays agregados.
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

  const round = (n: number) => Math.round(n * 100) / 100
  const localNome = new Map(evento.locais.map((l) => [l.id, l.nome]))

  // ════════════════════════════════════════════════════════════════
  // ⚡ ONDA 21.3 — LOOP ÚNICO
  // Antes: 2 varreduras sobre recebimentos (gráficos + doações).
  // Agora: 1 varredura alimentando todos os acumuladores.
  // ════════════════════════════════════════════════════════════════

  const kgPorLocalMap = new Map<string, number>()
  const kgPorTipoMap = new Map<string, number>()
  const kgPorDiaMap = new Map<string, number>()
  let totalKg = 0

  // 🔥 ONDA 21.3 — fatos AGREGADOS por (dia | localNome | tipo | unidade).
  // O tipo Fato não possui campo único por recebimento, então a agregação
  // é matematicamente equivalente: filtrarFatos/derivarMetrics não mudam.
  // Payload deixa de crescer com nº de recebimentos.
  const fatosMap = new Map<
    string,
    { localNome: string; tipo: string; unidade: string; dia: string; quantidade: number }
  >()

  // Acumuladores da aba Doações
  type ProdAcc = Map<string, { nome: string; unidade: string; quantidade: number }>
  const porLocalAcc = new Map<string, { id: string; nome: string; produtos: ProdAcc }>()
  const totalGeralMap = new Map<string, number>()

  for (const r of evento.recebimentos) {
    const prod = r.alimento?.product
    const ln = localNome.get(r.localId) ?? '—'
    const tipo = prod?.name ?? 'Não informado'
    const unidade = r.unidade ?? prod?.unit ?? 'kg'
    const dia = r.createdAt.toISOString().slice(0, 10)
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
    if (!porLocalAcc.has(r.localId)) {
      porLocalAcc.set(r.localId, { id: r.localId, nome: ln, produtos: new Map() })
    }
    const localEntry = porLocalAcc.get(r.localId)!
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

  const totalRefugoKg = evento.alimentos.reduce((acc, a) => acc + (a.refugoKg ?? 0), 0)

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
  const hojeISO = new Date().toISOString().slice(0, 10)
  const inicioISO = evento.dataInicio.toISOString().slice(0, 10)
  const fimISO = evento.dataFim ? evento.dataFim.toISOString().slice(0, 10) : hojeISO
  const max = fimISO < hojeISO ? fimISO : hojeISO

  const d = new Date(`${max}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 6)
  const seteDiasISO = d.toISOString().slice(0, 10)
  const defaultStart = seteDiasISO < inicioISO ? inicioISO : seteDiasISO

  const range = { min: inicioISO, max, defaultStart, defaultEnd: max }

  // ════════════ SAÍDA da aba Doações ════════════
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
    },
    metrics,
    fatos,
    range,
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
