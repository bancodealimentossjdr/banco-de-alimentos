// scripts/importar-historico-2026.mjs
// Uso: node scripts/importar-historico-2026.mjs          → simulação (não grava)
//      node scripts/importar-historico-2026.mjs --apply  → grava (upsert, idempotente)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const ANO = 2026
const NOTA = 'Planilha 2026 RELATÓRIO BANCO DE ALIMENTOS'

// [origem, jan, fev, mar, abr] — kg
const DOACAO = [
  ['BH (Tejuco)', 6045.93, 4606.20, 4672.10, 3504.40],
  ['BH (Pátio)', 4548.30, 4563.50, 5724.07, 3874.85],
  ['BH (Leite)', 6392.33, 5038.37, 8264.30, 4580.55],
  ['Monterey', 293.10, 377.20, 2671.40, 8304.80],
  ['Esquinão (7 de Setembro)', 3360.82, 2428.80, 4119.20, 2886.10],
  ['Esquinão (Centro)', 2376.50, 1755.10, 0, 0],
  ['Esquinão (Tancredo)', 2823.50, 2464.60, 3769.80, 0],
  ['Esquinão (Inocoop)', 2685.00, 2545.40, 3142.97, 0],
  ['Esquinão (Tejuco)', 2313.40, 2336.30, 106.20, 0],
  ['Outros Mercados', 74.60, 189.70, 344.03, 0],
  ['Doação Produtores', 0, 1150.70, 168.10, 467.50],
]
const COLHEITA = [['Colheita Solidária', 3261.10, 4077.90, 7036.00, 4910.00]]
const DISTRIBUICAO = [
  ['Albergue', 0, 78, 265.3, 202.2],
  ['APAE', 0, 36, 157.6, 108.7],
  ['ASAPAC', 120.7, 111.8, 351.9, 215.7],
  ['ASCOM', 178.9, 282.2, 271.7, 319.6],
  ['CasaLar', 128.5, 2.5, 1014.5, 0],
  ['Celina Viegas', 16.3, 30.8, 0, 64.9],
  ['CRAS Matozinhos', 320.3, 457.1, 408.6, 412.1],
  ['CRAS Rural', 0, 287, 280.5, 216.5],
  ['CRAS Sr. dos Montes', 989.6, 1141.9, 1683.06, 713.6],
  ['CRAS Tejuco', 361.1, 377.6, 781.4, 266.2],
  ['Efraim', 1009.2, 857.5, 1064.5, 1072.4],
  ['Jesus Continua Fazendo Milagres', 790.7, 905.6, 1234.1, 1154.4],
  ['ONG Nova Geração', 725.7, 273.8, 527.6, 806.7],
  ['OSFA', 506.8, 143.4, 252.7, 135.1],
  ['Recanto da Serenidade', 0, 126.8, 253.5, 195.1],
  ['Renascer', 167.9, 86, 328.9, 179.3],
  ['Resgatando Vidas', 325.97, 346.6, 440.9, 190],
  ['Risoleta Neves', 864.7, 492.4, 418.5, 781],
  ['SACE', 0, 313.6, 286.9, 246.7],
  ['Sagrado Coração de Jesus', 0, 126.8, 222.9, 199.7],
  ['Santa Clara', 328.6, 271.9, 169.9, 378.8],
  ['Semente do Amanhã', 0, 90, 0, 0],
  ['Terra Santa', 0, 138.8, 257.8, 219.5],
  ['Vovô Faleiro', 330.8, 346.9, 93.7, 157.2],
]
// [CRAS, jan, fev, mar, abr] — nº de famílias (kg já está em DISTRIBUICAO)
const FAMILIAS = [
  ['CRAS Matozinhos', 263, 178, 0, 0],
  ['CRAS Rural', 54, 26, 0, 0],
  ['CRAS Sr. dos Montes', 172, 182, 0, 0],
  ['CRAS Tejuco', 113, 118, 0, 0],
]

function linhas(tipo, tabela, isAtend = false) {
  const out = []
  for (const [origem, ...meses] of tabela) {
    meses.forEach((v, i) => {
      if (!v) return
      out.push({
        ano: ANO, mes: i + 1, tipo, origem, nota: NOTA,
        kg: isAtend ? 0 : Math.round(v * 100) / 100,
        atendimentos: isAtend ? v : null,
      })
    })
  }
  return out
}

const registros = [
  ...linhas('DOACAO', DOACAO),
  ...linhas('COLHEITA', COLHEITA),
  ...linhas('DISTRIBUICAO', DISTRIBUICAO),
  ...linhas('FAMILIAS', FAMILIAS, true),
]

// 📊 Relatório de conferência
const resumo = {}
for (const r of registros) {
  const k = `${r.tipo}`.padEnd(13)
  resumo[k] ??= { 1: 0, 2: 0, 3: 0, 4: 0 }
  resumo[k][r.mes] += r.atendimentos ?? Number(r.kg)
}
console.log('\nTipo          |      Jan |      Fev |      Mar |      Abr |    Total')
for (const [k, m] of Object.entries(resumo)) {
  const vals = [1, 2, 3, 4].map(i => m[i])
  const fmt = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }).padStart(8)
  console.log(`${k} | ${vals.map(fmt).join(' | ')} | ${fmt(vals.reduce((a, b) => a + b, 0))}`)
}
console.log(`\n${registros.length} registros. (FAMILIAS = nº de famílias, não kg)`)

if (!APPLY) {
  console.log('\n🟡 SIMULAÇÃO. Nada gravado. Rode com --apply para gravar.\n')
  await prisma.$disconnect()
  process.exit(0)
}

await prisma.$transaction(
  registros.map(r =>
    prisma.historicoMensal.upsert({
      where: { ano_mes_tipo_origem: { ano: r.ano, mes: r.mes, tipo: r.tipo, origem: r.origem } },
      create: r,
      update: { kg: r.kg, atendimentos: r.atendimentos, nota: r.nota },
    })
  )
)
console.log(`\n✅ ${registros.length} registros gravados/atualizados.\n`)
await prisma.$disconnect()
