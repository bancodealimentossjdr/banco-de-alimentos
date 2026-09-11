// src/app/api/indicadores/rankings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { shouldMaskPersonalData, maskContactName } from '@/lib/mask-by-role'
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters'

/**
 * 🏆 GET /api/indicadores/rankings?type=produtos|doadores|beneficiarios|produtores
 *
 * ⚠️ REESCRITA TOTAL (Onda 23.7d).
 * A versão anterior era `GET()` sem request e devolvia listas de CADASTRO
 * lista de produtos ordenada por nome (antes duplicada em rota própria, removida na Onda 23.7d)
 * agregação por volume — nem de doação, nem de colheita.
 *
 * 🌾 Produtos somam as TRÊS origens que alimentam o estoque:
 *    doação (DonationItem) + colheita (HarvestItem) + PAA (EntregaPaaItem).
 *
 * 📐 Contrato de saída: { nome, total, ... } — `total` é o dataKey lido por
 *    GraficoBarras. Mantido `valor` como espelho para outros consumidores.
 */

const TOP_N = 10
const r1 = (n: number) => Math.round(n * 10) / 10

/* ==================================================================
 * 📅 Datas
 *
 * Donation / Distribution / SolidarityHarvest → `date` é DateTime pleno:
 *   usa as bordas de Brasília de parseIndicadoresQuery.
 *
 * EntregaPaa → `dataEntrega` é @db.Date. Prisma serializa DATE como
 *   meia-noite UTC. As bordas de Brasília (from = 03:00Z) EXCLUIRIAM o
 *   primeiro dia do período. Por isso o filtro PAA é montado à parte,
 *   a partir das strings YYYY-MM-DD cruas.
 * ================================================================== */
function paaDateFilter(fromRaw: string | null, toRaw: string | null) {
  const f: { gte?: Date; lte?: Date } = {}
  if (fromRaw) f.gte = new Date(`${fromRaw}T00:00:00.000Z`)
  if (toRaw) f.lte = new Date(`${toRaw}T00:00:00.000Z`)
  return Object.keys(f).length ? { dataEntrega: f } : {}
}

/* ==================================================================
 * 🧑‍🌾 Funcionários ocupam 3 slots em Donation/Distribution/Harvest.
 *    Filtrar só por `employeeId` perderia participações nos slots 2 e 3.
 * ================================================================== */
function employeeOr(ids?: string[]) {
  if (!ids?.length) return {}
  return {
    OR: [
      { employeeId: { in: ids } },
      { employee2Id: { in: ids } },
      { employee3Id: { in: ids } },
    ],
  }
}

type Origem = 'doacao' | 'colheita' | 'paa'
type Agg = Map<
  string,
  { nome: string; doacao: number; colheita: number; paa: number }
>

function bump(agg: Agg, id: string, nome: string, origem: Origem, kg: number) {
  const cur = agg.get(id) ?? { nome, doacao: 0, colheita: 0, paa: 0 }
  cur[origem] += Number.isFinite(kg) ? kg : 0
  if (!cur.nome) cur.nome = nome
  agg.set(id, cur)
}

export async function GET(req: NextRequest) {
  // 🛡️ Backend nunca confia no frontend.
  const authResult = await requireView('indicadores')
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(req.url)
  const type = (searchParams.get('type') || 'produtos').toLowerCase()

  const q = parseIndicadoresQuery(req)
  const erro = validatePeriodo(q)
  if (erro) return NextResponse.json({ error: erro }, { status: 400 })

  const dateFilter: { gte?: Date; lte?: Date } = {}
  if (q.from) dateFilter.gte = q.from
  if (q.to) dateFilter.lte = q.to
  const whereDate = Object.keys(dateFilter).length ? { date: dateFilter } : {}
  const wherePaaDate = paaDateFilter(q.fromRaw, q.toRaw)

  // 🎭 Máscara no servidor — visualizador nunca recebe nome cru.
  //    Produtos NÃO são dado pessoal: ficam sempre legíveis.
  const session = await auth()
  const mask = shouldMaskPersonalData(session?.user?.role)
  const nm = (n?: string | null) =>
    mask ? maskContactName(n ?? '') : (n ?? '—')

  try {
    /* ============================================================
     * 🌾 PRODUTOS — doação + colheita + PAA
     * ============================================================ */
    if (type === 'produtos') {
      const [donItems, harvItems, paaItems] = await Promise.all([
        prisma.donationItem.findMany({
          where: {
            donation: {
              ...whereDate,
              ...(q.doadorIds ? { donorId: { in: q.doadorIds } } : {}),
              ...employeeOr(q.funcionarioIds),
            },
          },
          select: {
            quantity: true,
            productId: true,
            product: { select: { name: true } },
          },
        }),
        // ✅ FIX: o model é `harvestItem` (não `solidarityHarvestItem`).
        prisma.harvestItem.findMany({
          where: {
            harvest: {
              ...whereDate,
              ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
              ...employeeOr(q.funcionarioIds),
            },
          },
          select: {
            quantity: true,
            productId: true,
            product: { select: { name: true } },
          },
        }),
        // ✅ FIX: relação é `entregaPaa`; data é `dataEntrega`;
        //    o peso em kg é `pesoKg` (quantidade pode estar em cx/dz/mç).
        prisma.entregaPaaItem.findMany({
          where: {
            entregaPaa: {
              ...wherePaaDate,
              ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
              ...(q.funcionarioIds
                ? {
                    OR: [
                      { employeeId: { in: q.funcionarioIds } },
                      { employee2Id: { in: q.funcionarioIds } },
                    ],
                  }
                : {}),
            },
          },
          select: {
            pesoKg: true,
            productId: true,
            product: { select: { name: true } },
          },
        }),
      ])

      const agg: Agg = new Map()
      for (const i of donItems)
        bump(agg, i.productId, i.product?.name ?? '—', 'doacao', i.quantity)
      for (const i of harvItems)
        bump(agg, i.productId, i.product?.name ?? '—', 'colheita', i.quantity)
      for (const i of paaItems)
        bump(
          agg,
          i.productId,
          i.product?.name ?? '—',
          'paa',
          Number(i.pesoKg), // Decimal → number
        )

      const data = Array.from(agg.values())
        .map((v) => {
          const total = r1(v.doacao + v.colheita + v.paa)
          return {
            nome: v.nome,
            total, // 🔑 dataKey do GraficoBarras
            valor: total,
            doacao: r1(v.doacao),
            colheita: r1(v.colheita),
            paa: r1(v.paa),
          }
        })
        .filter((d) => d.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, TOP_N)

      return NextResponse.json(data)
    }

    /* ============================================================
     * 🏪 DOADORES — kg doados
     * ============================================================ */
    if (type === 'doadores') {
      const rows = await prisma.donation.findMany({
        where: {
          ...whereDate,
          ...(q.doadorIds ? { donorId: { in: q.doadorIds } } : {}),
          ...employeeOr(q.funcionarioIds),
        },
        select: {
          donorId: true,
          donor: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      })

      const agg = new Map<string, { nome: string; kg: number }>()
      for (const d of rows) {
        const kg = d.items.reduce((a, i) => a + (i.quantity ?? 0), 0)
        const cur = agg.get(d.donorId) ?? { nome: d.donor?.name ?? '—', kg: 0 }
        cur.kg += kg
        agg.set(d.donorId, cur)
      }

      return NextResponse.json(
        Array.from(agg.values())
          .map((v) => ({ nome: nm(v.nome), total: r1(v.kg), valor: r1(v.kg) }))
          .filter((d) => d.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, TOP_N),
      )
    }

    /* ============================================================
     * 👥 BENEFICIÁRIOS — kg recebidos
     * ============================================================ */
    if (type === 'beneficiarios') {
      const rows = await prisma.distribution.findMany({
        where: {
          ...whereDate,
          ...(q.beneficiarioIds
            ? { beneficiaryId: { in: q.beneficiarioIds } }
            : {}),
          ...employeeOr(q.funcionarioIds),
        },
        select: {
          beneficiaryId: true,
          beneficiary: { select: { name: true } },
          items: { select: { quantity: true } },
        },
      })

      const agg = new Map<string, { nome: string; kg: number }>()
      for (const d of rows) {
        const kg = d.items.reduce((a, i) => a + (i.quantity ?? 0), 0)
        const cur = agg.get(d.beneficiaryId) ?? {
          nome: d.beneficiary?.name ?? '—',
          kg: 0,
        }
        cur.kg += kg
        agg.set(d.beneficiaryId, cur)
      }

      return NextResponse.json(
        Array.from(agg.values())
          .map((v) => ({ nome: nm(v.nome), total: r1(v.kg), valor: r1(v.kg) }))
          .filter((d) => d.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, TOP_N),
      )
    }

    /* ============================================================
     * 🚜 PRODUTORES — colheita solidária + PAA
     * ============================================================ */
    if (type === 'produtores') {
      const [harvests, entregas] = await Promise.all([
        prisma.solidarityHarvest.findMany({
          where: {
            ...whereDate,
            ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
            ...employeeOr(q.funcionarioIds),
          },
          select: {
            producerId: true,
            producer: { select: { name: true } },
            items: { select: { quantity: true } },
          },
        }),
        prisma.entregaPaa.findMany({
          where: {
            ...wherePaaDate,
            ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
            ...(q.funcionarioIds
              ? {
                  OR: [
                    { employeeId: { in: q.funcionarioIds } },
                    { employee2Id: { in: q.funcionarioIds } },
                  ],
                }
              : {}),
          },
          select: {
            producerId: true,
            producer: { select: { name: true } },
            // ✅ pesoTotalKg já é denormalizado na EntregaPaa — 1 query, sem itens.
            pesoTotalKg: true,
          },
        }),
      ])

      const agg = new Map<
        string,
        { nome: string; colheita: number; paa: number }
      >()

      for (const h of harvests) {
        const kg = h.items.reduce((a, i) => a + (i.quantity ?? 0), 0)
        const cur = agg.get(h.producerId) ?? {
          nome: h.producer?.name ?? '—',
          colheita: 0,
          paa: 0,
        }
        cur.colheita += kg
        agg.set(h.producerId, cur)
      }

      for (const e of entregas) {
        const cur = agg.get(e.producerId) ?? {
          nome: e.producer?.name ?? '—',
          colheita: 0,
          paa: 0,
        }
        cur.paa += Number(e.pesoTotalKg ?? 0)
        agg.set(e.producerId, cur)
      }

      return NextResponse.json(
        Array.from(agg.values())
          .map((v) => {
            const total = r1(v.colheita + v.paa)
            return {
              nome: nm(v.nome),
              total,
              valor: total,
              colheita: r1(v.colheita),
              paa: r1(v.paa),
            }
          })
          .filter((d) => d.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, TOP_N),
      )
    }

    return NextResponse.json(
      { error: 'Parâmetro "type" inválido.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[indicadores/rankings] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular rankings.' },
      { status: 500 },
    )
  }
}
