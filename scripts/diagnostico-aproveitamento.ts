/**
 * 🔍 Diagnóstico de uso do DailyApproval
 * Onda 16.1 — Auditoria pré-commit
 *
 * Rodar com: npx tsx scripts/diagnostico-aproveitamento.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 ============ DIAGNÓSTICO DailyApproval ============\n')

  // 1️⃣ Visão geral
  console.log('📊 1️⃣ VISÃO GERAL\n')

  const todos = await prisma.dailyApproval.findMany({
    select: { date: true, approvedQty: true },
    orderBy: { date: 'asc' },
  })

  if (todos.length === 0) {
    console.log('⚠️  Nenhum registro encontrado na tabela DailyApproval.\n')
  } else {
    const diasDistintos = new Set(
      todos.map((r) => r.date.toISOString().slice(0, 10))
    ).size
    const totalKg = todos.reduce((acc, r) => acc + r.approvedQty, 0)
    const media = totalKg / todos.length

    console.log(`   Total de registros:        ${todos.length}`)
    console.log(`   Dias distintos:            ${diasDistintos}`)
    console.log(`   Primeiro registro:         ${todos[0].date.toISOString().slice(0, 10)}`)
    console.log(`   Último registro:           ${todos[todos.length - 1].date.toISOString().slice(0, 10)}`)
    console.log(`   Total aproveitado (kg):    ${totalKg.toFixed(2)}`)
    console.log(`   Média por registro (kg):   ${media.toFixed(2)}`)
  }

  // 2️⃣ Distribuição por mês
  console.log('\n📅 2️⃣ DISTRIBUIÇÃO POR MÊS\n')

  const porMes = new Map<string, { qtd: number; total: number }>()
  for (const r of todos) {
    const mes = r.date.toISOString().slice(0, 7)
    const atual = porMes.get(mes) ?? { qtd: 0, total: 0 }
    atual.qtd += 1
    atual.total += r.approvedQty
    porMes.set(mes, atual)
  }

  const mesesOrdenados = [...porMes.entries()].sort((a, b) =>
    b[0].localeCompare(a[0])
  )

  if (mesesOrdenados.length === 0) {
    console.log('   (sem dados)')
  } else {
    console.log('   Mês        | Qtd Reg. | Total (kg)')
    console.log('   -----------|----------|------------')
    for (const [mes, { qtd, total }] of mesesOrdenados) {
      console.log(
        `   ${mes}    | ${String(qtd).padStart(8)} | ${total.toFixed(2).padStart(10)}`
      )
    }
  }

  // 3️⃣ Cobertura: dias com doação vs dias com aproveitamento
  console.log('\n📈 3️⃣ COBERTURA (Doação vs Aproveitamento)\n')

  const doacoes = await prisma.donation.findMany({
    select: { date: true },
  })

  const diasComDoacao = new Set(
    doacoes.map((d) => d.date.toISOString().slice(0, 10))
  )
  const diasComAproveitamento = new Set(
    todos.map((r) => r.date.toISOString().slice(0, 10))
  )

  const diasComAmbos = [...diasComDoacao].filter((d) =>
    diasComAproveitamento.has(d)
  ).length

  const cobertura =
    diasComDoacao.size > 0
      ? (diasComAproveitamento.size / diasComDoacao.size) * 100
      : 0

  console.log(`   Dias com doação:              ${diasComDoacao.size}`)
  console.log(`   Dias com aproveitamento:      ${diasComAproveitamento.size}`)
  console.log(`   Dias com AMBOS:               ${diasComAmbos}`)
  console.log(`   % cobertura:                  ${cobertura.toFixed(1)}%`)

  // 🎯 Interpretação
  console.log('\n🎯 ============ INTERPRETAÇÃO ============\n')

  if (cobertura < 20) {
    console.log('   🚨 Cobertura MUITO BAIXA — DailyApproval está praticamente abandonado.')
  } else if (cobertura < 60) {
    console.log('   ⚠️  Cobertura PARCIAL — DailyApproval é usado de forma esporádica.')
  } else {
    console.log('   ✅ Cobertura BOA — DailyApproval é usado regularmente.')
  }

  console.log('\n========================================================\n')
}

main()
  .catch((err) => {
    console.error('❌ Erro ao rodar diagnóstico:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
