import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { canView } from '@/lib/permissions'
import { shouldMaskPersonalData, maskContactName } from '@/lib/mask-by-role'

type Fonte = 'legado' | 'app' | 'misto' | 'vazio'
interface Mes {
  mes: number
  doacaoKg: number
  colheitaKg: number
  distribuicaoKg: number
  fonte: Fonte
  parcial: boolean
}
interface LinhaLegado {
  mes: number
  tipo: string
  kg: number
}

const TZ = 'America/Sao_Paulo'

function anoMesAtual() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date())
  return {
    ano: Number(p.find((x) => x.type === 'year')!.value),
    mes: Number(p.find((x) => x.type === 'month')!.value),
  }
}

// 📜 Legado isolado: se a tabela faltar ou falhar, o painel segue sem ele
async function buscarLegado(ano: number): Promise<LinhaLegado[]> {
  try {
    const rows = await prisma.historicoMensal.groupBy({
      by: ['mes', 'tipo'],
      where: { ano, tipo: { in: ['DOACAO', 'COLHEITA', 'DISTRIBUICAO'] } },
      _sum: { kg: true },
    })
    return rows.map((r) => ({
      mes: Number(r.mes),
      tipo: String(r.tipo),
      kg: Number(r._sum.kg ?? 0),
    }))
  } catch (error) {
    console.error('Dashboard: historico_mensal indisponível, seguindo sem legado:', error)
    return []
  }
}

// ⚖️ Regra B: por mês e tipo, a planilha (legado) prevalece; sem legado, usa o app. Nunca soma.
function escolher(leg: number, app: number) {
  if (leg > 0) return { kg: leg, origem: 'legado' as const }
  if (app > 0) return { kg: app, origem: 'app' as const }
  return { kg: 0, origem: null }
}

export async function GET() {
  const authResult = await requireView('dashboard')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role
  const mask = shouldMaskPersonalData(role)
  const isGestor = role === 'admin' || role === 'dev'
  const vePaa = canView(role, 'paa')

  const { ano, mes: mesAtual } = anoMesAtual()
  const inicioAno = new Date(`${ano}-01-01T03:00:00.000Z`)
  const inicioProx = new Date(`${ano + 1}-01-01T03:00:00.000Z`)

  try {
    const [
      recentDonations,
      recentDistributions,
      recentHarvests,
      legado,
      appDoacao,
      appColheita,
      appDistribuicao,
      distPendentesCount,
      distPendentes,
      colheitasAgendadasCount,
      colheitasAgendadas,
      paaRascunhoCount,
      termosSemNfCount,
    ] = await Promise.all([
      prisma.donation.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          donor: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),
      prisma.distribution.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          beneficiary: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),
      prisma.solidarityHarvest.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: {
          producer: { select: { name: true } },
          items: { include: { product: { select: { name: true, unit: true } } } },
        },
      }),

      buscarLegado(ano),

      // 📊 App — por mês civil em São Paulo
      prisma.$queryRaw<{ mes: number; kg: number }[]>`
        SELECT EXTRACT(MONTH FROM d."date" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS mes,
               COALESCE(SUM(i."quantity"), 0)::float AS kg
        FROM "DonationItem" i JOIN "Donation" d ON d."id" = i."donationId"
        WHERE d."date" >= ${inicioAno} AND d."date" < ${inicioProx}
        GROUP BY 1`,
      prisma.$queryRaw<{ mes: number; kg: number }[]>`
        SELECT EXTRACT(MONTH FROM h."date" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS mes,
               COALESCE(SUM(i."quantity"), 0)::float AS kg
        FROM "HarvestItem" i JOIN "SolidarityHarvest" h ON h."id" = i."harvestId"
        WHERE h."status" = 'realizada' AND h."date" >= ${inicioAno} AND h."date" < ${inicioProx}
        GROUP BY 1`,
      prisma.$queryRaw<{ mes: number; kg: number }[]>`
        SELECT EXTRACT(MONTH FROM d."date" AT TIME ZONE 'UTC' AT TIME ZONE ${TZ})::int AS mes,
               COALESCE(SUM(i."quantity"), 0)::float AS kg
        FROM "DistributionItem" i JOIN "Distribution" d ON d."id" = i."distributionId"
        WHERE d."legacy" = false AND d."date" >= ${inicioAno} AND d."date" < ${inicioProx}
        GROUP BY 1`,

      // ⏳ Pendências
      prisma.distribution.count({ where: { status: 'PENDENTE', legacy: false } }),
      prisma.distribution.findMany({
        where: { status: 'PENDENTE', legacy: false },
        take: 5,
        orderBy: { date: 'asc' },
        select: { id: true, date: true, beneficiary: { select: { name: true } } },
      }),
      prisma.solidarityHarvest.count({ where: { status: 'agendada' } }),
      prisma.solidarityHarvest.findMany({
        where: { status: 'agendada' },
        take: 5,
        orderBy: { date: 'asc' },
        select: { id: true, date: true, producer: { select: { name: true } } },
      }),
      vePaa ? prisma.entregaPaa.count({ where: { status: 'RASCUNHO' } }) : Promise.resolve(null),
      isGestor ? prisma.termoPaa.count({ where: { notaFiscal: null } }) : Promise.resolve(null),
    ])

    // 🧮 Monta a série jan → mês atual
    const somaApp = (rows: { mes: number; kg: number }[], m: number) =>
      Number(rows.find((r) => Number(r.mes) === m)?.kg ?? 0)
    const somaLeg = (tipo: string, m: number) =>
      legado.find((r) => r.mes === m && r.tipo === tipo)?.kg ?? 0
    const r2 = (n: number) => Math.round(n * 100) / 100

    const historico: Mes[] = []
    for (let m = 1; m <= mesAtual; m++) {
      const d = escolher(somaLeg('DOACAO', m), somaApp(appDoacao, m))
      const c = escolher(somaLeg('COLHEITA', m), somaApp(appColheita, m))
      const x = escolher(somaLeg('DISTRIBUICAO', m), somaApp(appDistribuicao, m))
      const origens = new Set([d.origem, c.origem, x.origem].filter(Boolean))
      historico.push({
        mes: m,
        doacaoKg: r2(d.kg),
        colheitaKg: r2(c.kg),
        distribuicaoKg: r2(x.kg),
        fonte:
          origens.size === 0 ? 'vazio'
          : origens.size > 1 ? 'misto'
          : origens.has('legado') ? 'legado' : 'app',
        parcial: m === mesAtual,
      })
    }

    // 🔐 LGPD — mascaramento no servidor
    const nome = (n: string) => (mask ? maskContactName(n) : n)

    const safeRecentDonations = recentDonations.map((d) => ({
      ...d,
      notes: mask ? null : d.notes,
      donor: { name: nome(d.donor.name) },
    }))
    const safeRecentDistributions = recentDistributions.map((d) => ({
      ...d,
      notes: mask ? null : d.notes,
      beneficiary: { name: nome(d.beneficiary.name) },
    }))
    const safeRecentHarvests = recentHarvests.map((h) => ({
      ...h,
      notes: mask ? null : h.notes,
      indemnityValue: mask ? null : h.indemnityValue,
      producer: { name: nome(h.producer.name) },
    }))

    return NextResponse.json({
      stockItems: [],
      notifications: [],
      recentDonations: safeRecentDonations,
      recentDistributions: safeRecentDistributions,
      recentHarvests: safeRecentHarvests,

      ano,
      historico,
      pendencias: {
        distribuicoes: {
          total: distPendentesCount,
          itens: distPendentes.map((d) => ({
            id: d.id,
            date: d.date,
            nome: nome(d.beneficiary.name),
          })),
        },
        paaRascunho: paaRascunhoCount,
        termosSemNf: termosSemNfCount,
      },
      colheitasAgendadas: {
        total: colheitasAgendadasCount,
        itens: colheitasAgendadas.map((h) => ({
          id: h.id,
          date: h.date,
          nome: nome(h.producer.name),
        })),
      },
    })
  } catch (error) {
    console.error('Erro GET dashboard:', error)
    return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
