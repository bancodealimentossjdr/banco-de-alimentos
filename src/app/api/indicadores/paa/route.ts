// src/app/api/indicadores/paa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { shouldMaskPersonalData } from '@/lib/mask-by-role'
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters'

/**
 * 🌾 GET /api/indicadores/paa  (Onda 23.7e-1)
 *
 *   card                 → total entregue no período (kg, entregas, produtores)
 *   topProdutos          → Top 10 produtos entregues (kg)
 *   topProdutosOrganicos → Top 10 produtos orgânicos entregues (kg)
 *
 * ⚠️ Sem gráfico de produtores — isso já vive em /rankings?type=produtores.
 *
 * 📐 Arrays no formato { nome, total, valor }: `total` é o dataKey lido por
 *    GraficoBarras. Mesma forma de /rankings, pra reaproveitar o componente.
 *
 * 🧮 pesoKg está GRAVADO em EntregaPaaItem desde a 23.1 (fatorKg congelado).
 *    Aqui somamos. Nunca recalculamos.
 */

const TOP_N = 10
const r1 = (n: number) => Math.round(n * 10) / 10

/* ==================================================================
 * 📅 EntregaPaa.dataEntrega é @db.Date → Prisma serializa como
 *    meia-noite UTC. As bordas de Brasília (from = 03:00Z) excluiriam
 *    o primeiro dia. Filtro montado das strings YYYY-MM-DD cruas.
 *    (idêntica à de /rankings — candidata a extrair pra lib)
 * ================================================================== */
function paaDateFilter(fromRaw: string | null, toRaw: string | null) {
  const f: { gte?: Date; lte?: Date } = {}
  if (fromRaw) f.gte = new Date(`${fromRaw}T00:00:00.000Z`)
  if (toRaw) f.lte = new Date(`${toRaw}T00:00:00.000Z`)
  return Object.keys(f).length ? { dataEntrega: f } : {}
}

/* 🧑‍🌾 EntregaPaa tem 2 slots de funcionário (Donation tem 3). */
function paaEmployeeOr(ids?: string[]) {
  if (!ids?.length) return {}
  return { OR: [{ employeeId: { in: ids } }, { employee2Id: { in: ids } }] }
}

export async function GET(req: NextRequest) {
  // 🛡️ Backend nunca confia no frontend.
  const authResult = await requireView('indicadores')
  if (authResult instanceof NextResponse) return authResult

  const q = parseIndicadoresQuery(req)
  const erro = validatePeriodo(q)
  if (erro) return NextResponse.json({ error: erro }, { status: 400 })

  const whereEntrega = {
    ...paaDateFilter(q.fromRaw, q.toRaw),
    ...(q.produtorIds ? { producerId: { in: q.produtorIds } } : {}),
    ...paaEmployeeOr(q.funcionarioIds),
  }

  // 🎭 Máscara financeira (antecipa a 23.8): visualizador recebe null,
  //    não zero e não string. Fail-secure: role desconhecido → mascara.
  const session = await auth()
  const mascararValor = shouldMaskPersonalData(session?.user?.role)

  try {
    const [entregas, itens] = await Promise.all([
      // pesoTotalKg/valorTotal são denormalizados na EntregaPaa — sem varrer itens.
      prisma.entregaPaa.findMany({
        where: whereEntrega,
        select: { producerId: true, pesoTotalKg: true, valorTotal: true },
      }),
      prisma.entregaPaaItem.findMany({
        where: { entregaPaa: whereEntrega },
        select: {
          pesoKg: true,
          tipoCultivo: true,
          productId: true,
          product: { select: { name: true } },
        },
      }),
    ])

    /* ---------- Card do topo ---------- */
    const totalKg = entregas.reduce((a, e) => a + Number(e.pesoTotalKg ?? 0), 0)
    const totalValor = entregas.reduce((a, e) => a + Number(e.valorTotal ?? 0), 0)
    const produtoresAtivos = new Set(entregas.map((e) => e.producerId)).size

    /* ---------- Agregação por produto ---------- */
    type Bucket = { nome: string; total: number; organico: number }
    const agg = new Map<string, Bucket>()

    for (const i of itens) {
      const kg = Number(i.pesoKg ?? 0) // Decimal → number
      if (!Number.isFinite(kg)) continue
      const cur =
        agg.get(i.productId) ??
        { nome: i.product?.name ?? '—', total: 0, organico: 0 }
      cur.total += kg
      // 🍃 tipoCultivo é do ITEM (preço CONAB difere por cultivo).
      if (i.tipoCultivo === 'ORGANICO') cur.organico += kg
      agg.set(i.productId, cur)
    }

    const buckets = Array.from(agg.values())

    const topProdutos = buckets
      .map((v) => ({ nome: v.nome, total: r1(v.total), valor: r1(v.total) }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N)

    const topProdutosOrganicos = buckets
      .map((v) => ({ nome: v.nome, total: r1(v.organico), valor: r1(v.organico) }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_N)

    return NextResponse.json({
      card: {
        totalKg: r1(totalKg),
        totalEntregas: entregas.length,
        produtoresAtivos,
        totalValor: mascararValor ? null : r1(totalValor),
      },
      topProdutos,
      topProdutosOrganicos,
      calculatedAt: new Date(),
    })
  } catch (error) {
    console.error('[indicadores/paa] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular indicadores do PAA.' },
      { status: 500 },
    )
  }
}
