import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'
import { calculateUtilization } from '@/lib/stock/calculate-utilization'
import {
  parseIndicadoresQuery,
  validatePeriodo,
} from '@/lib/indicadores/filters'

export async function GET(req: NextRequest) {
  // 🛡️ Backend nunca confia no frontend.
  const auth = await requireView('indicadores')
  if (auth instanceof NextResponse) return auth

  const q = parseIndicadoresQuery(req)
  const erro = validatePeriodo(q)
  if (erro) return NextResponse.json({ error: erro }, { status: 400 })

  // 📅 Bordas já em horário de Brasília (day-boundaries).
  // Removido o setUTCHours local — divergia de /aproveitamento.
  const from = q.from ?? new Date('1970-01-01T00:00:00.000Z')
  const to = q.to ?? new Date()

  try {
    // 🧮 Fonte ÚNICA das fórmulas (Onda 16.5), agora com os 4 filtros.
    const { volumes, utilization } = await calculateUtilization({
      from,
      to,
      donorIds: q.doadorIds,
      producerIds: q.produtorIds,
      beneficiaryIds: q.beneficiarioIds,
      employeeIds: q.funcionarioIds,
    })

    // 📦 emEstoque REMOVIDO (23.7c): saldo instantâneo não é indicador
    //    de período. Vive em /estoque, sua fonte de verdade.
    //    Bônus: uma query a menos por carga.

    const beneficiariosUnicos = await prisma.distribution.findMany({
      where: {
        date: { gte: from, lte: to },
        ...(q.beneficiarioIds ? { beneficiaryId: { in: q.beneficiarioIds } } : {}),
        ...(q.funcionarioIds ? { employeeId: { in: q.funcionarioIds } } : {}),
      },
      select: { beneficiaryId: true },
      distinct: ['beneficiaryId'],
    })

    return NextResponse.json({
      totalDoado: volumes.donationsKg,
      totalDistribuido: volumes.distributedKg,
      totalColheita: volumes.harvestKg,
      percentualAproveitamento: utilization?.utilizationPct ?? 0,
      beneficiariosAtendidos: beneficiariosUnicos.length,
      calculatedAt: new Date(),
    })
  } catch (error) {
    console.error('[indicadores/macro] Erro inesperado:', error)
    return NextResponse.json(
      { error: 'Erro ao calcular indicadores macro.' },
      { status: 500 },
    )
  }
}
