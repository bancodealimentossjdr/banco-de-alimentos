import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { calculateStock } from '@/lib/stock/calculate-stock'
import { shouldMaskPersonalData } from '@/lib/mask-by-role'

export const dynamic = 'force-dynamic'

export async function GET() {
  // 🔐 1. Auth de acesso
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    // 🔐 2. Descobre role para máscara de saldo
    let maskSaldo = false
    try {
      const session = await auth()
      maskSaldo = shouldMaskPersonalData(session?.user?.role)
    } catch (e) {
      console.error('[resumo] Falha ao obter role (seguindo sem máscara):', e)
      maskSaldo = false
    }

    // 📦 3. Snapshot do estoque (Marco Zero)
    const snapshot = await calculateStock()

    // 📊 4. Agregados globais
    const [donationAgg, harvestAgg, distributionAgg, approvalAgg] =
      await Promise.all([
        prisma.donationItem.aggregate({ _sum: { quantity: true } }),
        prisma.harvestItem.aggregate({
          _sum: { quantity: true },
          where: { harvest: { status: 'realizada' } },
        }),
        prisma.distributionItem.aggregate({
          _sum: { quantity: true },
          where: { distribution: { origem: 'DOACAO' } },
        }),
        prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
      ])

    const donations = donationAgg._sum.quantity ?? 0
    const solidarityHarvest = harvestAgg._sum.quantity ?? 0
    const distributed = distributionAgg._sum.quantity ?? 0
    const approved = approvalAgg._sum.approvedQty ?? 0

    const utilizationRate = donations > 0 ? (approved / donations) * 100 : 0
    const inStock = snapshot.hasMarker
      ? snapshot.currentStockKg
      : approved + solidarityHarvest - distributed

    // ============================================
    // 🆕 ONDA 18 — RESERVATÓRIO DE EVENTOS (por unidade)
    // 🛡️ Isolado: falha aqui NÃO derruba o resumo geral
    // ============================================
    let eventosPorUnidade: {
      unidade: string
      arrecadado: number
      distribuido: number
      saldo: number
    }[] = []

    try {
      const recebimentosPorUnidade = await prisma.recebimento.groupBy({
        by: ['unidade'],
        _sum: { quantidade: true },
      })

      const itensEventoDistribuidos = await prisma.distributionItem.findMany({
        where: { distribution: { origem: 'EVENTO' } },
        select: {
          quantity: true,
          product: { select: { unit: true } },
        },
      })

      const eventoSaldoMap: Record<
        string,
        { arrecadado: number; distribuido: number }
      > = {}
      const normUnidade = (u: string) => (u || 'un').trim().toLowerCase()

      for (const r of recebimentosPorUnidade) {
        const u = normUnidade(r.unidade)
        if (!eventoSaldoMap[u])
          eventoSaldoMap[u] = { arrecadado: 0, distribuido: 0 }
        eventoSaldoMap[u].arrecadado += r._sum.quantidade ?? 0
      }

      for (const item of itensEventoDistribuidos) {
        // 🛡️ AJUSTE 1: product pode ser null se relação for opcional
        const u = normUnidade(item.product?.unit ?? 'un')
        if (!eventoSaldoMap[u])
          eventoSaldoMap[u] = { arrecadado: 0, distribuido: 0 }
        eventoSaldoMap[u].distribuido += item.quantity
      }

      eventosPorUnidade = Object.entries(eventoSaldoMap)
        .map(([unidade, v]) => ({
          unidade,
          arrecadado: Number(v.arrecadado.toFixed(2)),
          distribuido: Number(v.distribuido.toFixed(2)),
          saldo: Number((v.arrecadado - v.distribuido).toFixed(2)),
        }))
        .sort((a, b) => a.unidade.localeCompare(b.unidade))
    } catch (evErr) {
      console.error('[resumo] Falha no reservatório de eventos:', evErr)
      eventosPorUnidade = []
    }

    // 📦 5. Payload completo
    const payload = {
      hasMarker: snapshot.hasMarker,
      baseMarker: snapshot.baseMarker,
      currentStockKg: snapshot.currentStockKg,
      movementsSinceMarker: snapshot.movements,
      infoSinceMarker: snapshot.info,
      calculatedAt: snapshot.calculatedAt,
      donations,
      solidarityHarvest,
      approved,
      distributed,
      inStock,
      inStockBreakdown: snapshot.hasMarker
        ? {
            baseMarkerKg: snapshot.baseMarker?.quantityKg ?? 0,
            approvedSinceMarker: snapshot.movements.approvedKg,
            harvestSinceMarker: snapshot.movements.harvestKg,
            distributedSinceMarker: snapshot.movements.distributedKg,
          }
        : {
            approved,
            solidarityHarvest,
            distributed,
          },
      utilizationRate: Number(utilizationRate.toFixed(1)),
      eventos: {
        porUnidade: eventosPorUnidade,
        totalRecebimentos: eventosPorUnidade.reduce(
          (s, e) => s + e.arrecadado,
          0
        ),
      },
      debug: {
        mode: snapshot.hasMarker ? 'marker-based' : 'legacy-fallback',
        formula: snapshot.hasMarker
          ? 'inStock = baseMarker + approvedSince + harvestSince − distributedSince (origem DOACAO)'
          : 'inStock = totalApproved + totalHarvestRealized − totalDistributed (legacy)',
        harvestStatusFilter: 'realizada',
        onda18:
          'Distribuições origem=EVENTO excluídas do reservatório geral; eventos calculados por unidade separada.',
        ...(snapshot.hasMarker &&
          snapshot.currentStockKg < 0 && {
            warning:
              '⚠️ Estoque negativo: saídas desde o marco > entradas. Verificar dados ou criar nova recalibração (ADJUSTMENT).',
          }),
        ...(!snapshot.hasMarker && {
          warning:
            '⚠️ Nenhum Marco Zero cadastrado. Saldo calculado pelo modelo legado. Crie o Marco Zero para calibrar o estoque oficialmente.',
        }),
      },
    }

    // 🔐 6. Máscara para visualizador
    if (maskSaldo) {
      const {
        currentStockKg,
        inStock,
        inStockBreakdown,
        baseMarker,
        movementsSinceMarker,
        eventos,
        debug,
        ...safe
      } = payload
      void currentStockKg
      void inStock
      void inStockBreakdown
      void baseMarker
      void movementsSinceMarker
      void eventos

      const { warning, ...debugSafe } = debug
      void warning

      return NextResponse.json({ ...safe, debug: debugSafe })
    }

    return NextResponse.json(payload)
  } catch (error) {
    // 🔍 Log detalhado — mostra a mensagem real no terminal
    console.error(
      '[/api/estoque/resumo] Erro:',
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : ''
    )
    return NextResponse.json(
      {
        error: 'Erro ao calcular resumo do estoque',
      },
      { status: 500 }
    )
  }
}
