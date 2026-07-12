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
    const [
      donationAgg,
      harvestAgg,
      distDonationAgg,
      distHarvestAgg,
      approvalAgg,
    ] = await Promise.all([
      prisma.donationItem.aggregate({ _sum: { quantity: true } }),
      prisma.harvestItem.aggregate({
        _sum: { quantity: true },
        where: { harvest: { status: 'realizada' } },
      }),
      // 🥫 saídas DOAÇÃO (por item — fonte de verdade)
      prisma.distributionItem.aggregate({
        _sum: { quantity: true },
        where: { origem: 'DOACAO' },
      }),
      // 🆕 ONDA 19 — 🌾 saídas COLHEITA (por item)
      prisma.distributionItem.aggregate({
        _sum: { quantity: true },
        where: { origem: 'COLHEITA' },
      }),
      prisma.dailyApproval.aggregate({ _sum: { approvedQty: true } }),
    ])

    const donations = donationAgg._sum.quantity ?? 0
    const solidarityHarvest = harvestAgg._sum.quantity ?? 0
    const distributedDonation = distDonationAgg._sum.quantity ?? 0
    const distributedHarvest = distHarvestAgg._sum.quantity ?? 0
    const distributed = distributedDonation // compat com payload antigo
    const approved = approvalAgg._sum.approvedQty ?? 0

    const utilizationRate = donations > 0 ? (approved / donations) * 100 : 0

    // 🆕 ONDA 19 — gavetas separadas
    const donationStockKg = snapshot.hasMarker
      ? snapshot.donationStockKg
      : approved - distributedDonation
    const harvestStockKg = snapshot.hasMarker
      ? snapshot.harvestStockKg
      : solidarityHarvest - distributedHarvest
    const inStock = snapshot.hasMarker
      ? snapshot.currentStockKg
      : donationStockKg + harvestStockKg

    // ============================================
    // 🎪 RESERVATÓRIO DE EVENTOS (por unidade)
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
        where: { origem: 'EVENTO' },
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

    // 🆕 Total geral arrecadado em eventos (soma bruta de TODAS as unidades).
    // ⚠️ NÃO é sensível — vai no payload inclusive para o VISUALIZADOR.
    const totalArrecadadoGeral = Number(
      eventosPorUnidade.reduce((s, e) => s + e.arrecadado, 0).toFixed(2),
    )

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
      // 🆕 ONDA 19 — gavetas de kg separadas
      donationStockKg,
      harvestStockKg,
      distributedDonation,
      distributedHarvest,
      inStockBreakdown: snapshot.hasMarker
        ? {
            baseMarkerKg: snapshot.baseMarker?.quantityKg ?? 0,
            approvedSinceMarker: snapshot.movements.approvedKg,
            harvestSinceMarker: snapshot.movements.harvestKg,
            distributedDonationSinceMarker:
              snapshot.movements.distributedDonationKg,
            distributedHarvestSinceMarker:
              snapshot.movements.distributedHarvestKg,
          }
        : {
            approved,
            solidarityHarvest,
            distributedDonation,
            distributedHarvest,
          },
      utilizationRate: Number(utilizationRate.toFixed(1)),
      eventos: {
        porUnidade: eventosPorUnidade,
        totalRecebimentos: totalArrecadadoGeral,
        // 🆕 sempre presente (mantido também na versão mascarada abaixo)
        totalArrecadadoGeral,
      },
      debug: {
        mode: snapshot.hasMarker ? 'marker-based' : 'legacy-fallback',
        formula: snapshot.hasMarker
          ? 'doacao = baseMarker + approvedSince − distribDOACAO · colheita = harvestSince − distribCOLHEITA · inStock = doacao + colheita'
          : 'doacao = approved − distribDOACAO · colheita = harvestRealized − distribCOLHEITA (legacy)',
        harvestStatusFilter: 'realizada',
        onda19:
          'Gaveta COLHEITA independente (kg). Marco Zero só na gaveta DOAÇÃO. EVENTO isolado por unidade.',
        ...(snapshot.hasMarker &&
          snapshot.currentStockKg < 0 && {
            warning:
              '⚠️ Estoque negativo: saídas desde o marco > entradas. Verificar dados ou criar nova recalibração (ADJUSTMENT).',
          }),
        ...(snapshot.hasMarker &&
          harvestStockKg < 0 && {
            warningColheita:
              '⚠️ Gaveta de colheita negativa: distribuiu-se mais colheita do que foi colhido/registrado.',
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
        donationStockKg: _ds,
        harvestStockKg: _hs,
        distributedDonation: _dd,
        distributedHarvest: _dh,
        ...safe
      } = payload
      void currentStockKg
      void inStock
      void inStockBreakdown
      void baseMarker
      void movementsSinceMarker
      void _ds
      void _hs
      void _dd
      void _dh

      const { warning, warningColheita, ...debugSafe } = debug
      void warning
      void warningColheita

      // 🆕 Mantém APENAS o total agregado de eventos para o visualizador.
      // O detalhamento por unidade (porUnidade) e o breakdown continuam ocultos.
      const eventosSafe = {
        totalArrecadadoGeral: eventos.totalArrecadadoGeral,
      }

      return NextResponse.json({
        ...safe,
        eventos: eventosSafe,
        debug: debugSafe,
      })
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error(
      '[/api/estoque/resumo] Erro:',
      error instanceof Error ? error.message : error,
      error instanceof Error ? error.stack : '',
    )
    return NextResponse.json(
      { error: 'Erro ao calcular resumo do estoque' },
      { status: 500 },
    )
  }
}
