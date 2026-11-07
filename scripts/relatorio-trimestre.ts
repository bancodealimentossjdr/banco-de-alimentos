// scripts/relatorio-trimestre.ts
// Gera relatorio-jul-set-2026.html direto do banco.
// Regra: cada lançamento entra na semana (quarta a terça) da sua data,
// e a semana entra no mês da quarta-feira em que começa.
import { writeFileSync } from 'node:fs'
import { prisma } from '../src/lib/prisma'

const DIA = 86_400_000
const INICIO = new Date('2026-07-01T00:00:00-03:00') // quarta-feira
const SEMANAS = 14
const FIM = new Date(INICIO.getTime() + SEMANAS * 7 * DIA) // 07/10 00:00, exclusivo
const FIM_CALENDARIO = new Date('2026-10-01T00:00:00-03:00')
const TIPO_CRAS = 'CRAS'
const STATUS_COLHEITA_OK = ['realizada', 'concluida'] // ⚠️ confira os valores reais
// ⚠️ Cestas ainda digitadas à mão (planilha). Backlog: registrar no sistema.
const CESTAS = [159, 146, 174, 162, 159, 159, 154, 296, 278, 282, 278, 292, 294, 291]
const MESES = ['07', '08', '09'] as const
const NOME: Record<string, string> = { '07': 'Julho', '08': 'Agosto', '09': 'Setembro' }
const EMISSAO = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

type Mes = (typeof MESES)[number]
type PorMes = Record<Mes, number>
const zero = (): PorMes => ({ '07': 0, '08': 0, '09': 0 })
const soma = (m: PorMes) => MESES.reduce((a, k) => a + m[k], 0)
const isKg = (u?: string | null) => (u ?? '').trim().toLowerCase() === 'kg'
const kg = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const semanaIdx = (d: Date) => Math.floor((d.getTime() - INICIO.getTime()) / (7 * DIA))
const mesDaSemana = (idx: number): Mes => {
  const quarta = new Date(INICIO.getTime() + idx * 7 * DIA - 3 * 3_600_000) // horário de Brasília
  return String(quarta.getUTCMonth() + 1).padStart(2, '0') as Mes
}
const mesDe = (d: Date) => mesDaSemana(semanaIdx(d))

async function main() {
  const periodo = { gte: INICIO, lt: FIM }
  const [dists, colheitas, doacoes] = await Promise.all([
    prisma.distribution.findMany({
      where: { date: periodo },
      select: {
        date: true,
        beneficiary: { select: { id: true, name: true, type: true } },
        items: { select: { quantity: true, origem: true, product: { select: { unit: true } } } },
      },
    }),
    prisma.solidarityHarvest.findMany({
      where: { date: periodo },
      select: { date: true, status: true, items: { select: { quantity: true, product: { select: { unit: true } } } } },
    }),
    prisma.donation.findMany({
      where: { date: periodo },
      select: { date: true, origin: true, items: { select: { quantity: true, product: { select: { unit: true } } } } },
    }),
  ])

  const recebido = zero(), colheita = zero(), cras = zero(), inst = zero(), distColheita = zero()
  const recPorOrigem = new Map<string, PorMes>()
  const porBenef = new Map<string, { nome: string; cras: boolean; m: PorMes }>()
  let kgAte30set = 0, foraKg = 0

  for (const d of doacoes) {
    const m = mesDe(d.date)
    for (const i of d.items) {
      if (!isKg(i.product.unit)) { foraKg++; continue }
      recebido[m] += i.quantity
      const o = d.origin || 'não informada'
      if (!recPorOrigem.has(o)) recPorOrigem.set(o, zero())
      recPorOrigem.get(o)![m] += i.quantity
    }
  }

  for (const h of colheitas) {
    if (!STATUS_COLHEITA_OK.includes(h.status.toLowerCase())) continue
    const m = mesDe(h.date)
    for (const i of h.items) isKg(i.product.unit) ? (colheita[m] += i.quantity) : foraKg++
  }

  for (const d of dists) {
    const m = mesDe(d.date)
    const ehCras = d.beneficiary.type?.trim().toUpperCase() === TIPO_CRAS
    const b = porBenef.get(d.beneficiary.id) ?? { nome: d.beneficiary.name, cras: ehCras, m: zero() }
    porBenef.set(d.beneficiary.id, b)
    for (const i of d.items) {
      if (!isKg(i.product.unit)) { foraKg++; continue }
      ;(ehCras ? cras : inst)[m] += i.quantity
      b.m[m] += i.quantity
      if ((i.origem ?? 'DOACAO').toUpperCase() === 'COLHEITA') distColheita[m] += i.quantity
      if (d.date < FIM_CALENDARIO) kgAte30set += i.quantity
    }
  }

  // ── Cálculos por mês
  const cestas = zero()
  CESTAS.forEach((c, idx) => (cestas[mesDaSemana(idx)] += c))
  const semanas = zero()
  CESTAS.forEach((_, idx) => semanas[mesDaSemana(idx)]++)
  const distrib = zero(), totalDoado = zero(), media = zero(), equiv = zero()
  for (const m of MESES) {
    distrib[m] = cras[m] + inst[m]
    totalDoado[m] = distrib[m] + colheita[m] - distColheita[m]
    media[m] = cestas[m] ? cras[m] / cestas[m] : 0
    equiv[m] = media[m] ? inst[m] / media[m] : 0
  }
  const mediaTri = soma(cestas) ? soma(cras) / soma(cestas) : 0
  const equivTri = mediaTri ? soma(inst) / mediaTri : 0

  // ── Linhas: [rótulo, valores, total, descrição]
  type Linha = [string, (m: Mes) => string, string, string]
  const linhasMes: Linha[] = [
    ['Semanas de distribuição', (m) => int(semanas[m]), int(SEMANAS), 'Semanas de quarta a terça. Cada semana entra no mês da quarta-feira em que começa.'],
    ['Recebido em doações', (m) => kg(recebido[m]), kg(soma(recebido)), 'Soma dos itens em kg de todas as doações registradas no período (comércio, parceiros, comunidade).'],
    ['Colhido no campo', (m) => kg(colheita[m]), kg(soma(colheita)), 'Soma dos itens em kg das colheitas solidárias com status realizada/concluída.'],
    ['Distribuído aos CRAS', (m) => kg(cras[m]), kg(soma(cras)), 'Soma dos itens em kg das distribuições a beneficiários do tipo CRAS.'],
    ['Distribuído às instituições', (m) => kg(inst[m]), kg(soma(inst)), 'Soma dos itens em kg das distribuições aos demais beneficiários.'],
    ['Total distribuído', (m) => kg(distrib[m]), kg(soma(distrib)), 'Distribuído aos CRAS + distribuído às instituições.'],
    ['Total doado à comunidade', (m) => kg(totalDoado[m]), kg(soma(totalDoado)), 'Total distribuído + colhido no campo − parte da colheita já contada na distribuição (evita contar duas vezes).'],
    ['Cestas entregues (CRAS)', (m) => int(cestas[m]), int(soma(cestas)), 'Cestas registradas por semana na planilha de distribuição dos CRAS.'],
    ['Média por cesta', (m) => kg(media[m]), kg(mediaTri), 'Distribuído aos CRAS ÷ cestas entregues.'],
    ['Cestas equivalentes (instituições)', (m) => `≈ ${int(equiv[m])}`, `≈ ${int(equivTri)}`, 'Distribuído às instituições ÷ média por cesta. Estimativa para comparação; não são cestas físicas.'],
  ]

  const tabelaMes = linhasMes.map(([r, v, t, d]) =>
    `<tr><td><b>${r}</b><div class="desc">${d}</div></td>${MESES.map((m) => `<td>${v(m)}</td>`).join('')}<td class="total">${t}</td></tr>`).join('')

  const origens = [...recPorOrigem].sort((a, b) => soma(b[1]) - soma(a[1]))
  const tabelaOrigem = origens.map(([o, v]) =>
    `<tr><td>${esc(o)}</td>${MESES.map((m) => `<td>${kg(v[m])}</td>`).join('')}<td class="total">${kg(soma(v))}</td></tr>`).join('')

  const tabelaBenef = (lista: { nome: string; m: PorMes }[]) => {
    const tot = zero()
    const rows = lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((b) => {
      MESES.forEach((m) => (tot[m] += b.m[m]))
      return `<tr><td>${esc(b.nome)}</td>${MESES.map((m) => `<td>${b.m[m] ? kg(b.m[m]) : '—'}</td>`).join('')}<td class="total">${kg(soma(b.m))}</td></tr>`
    }).join('')
    return rows + `<tr class="rodape"><td>Total geral (${lista.length})</td>${MESES.map((m) => `<td>${kg(tot[m])}</td>`).join('')}<td>${kg(soma(tot))}</td></tr>`
  }
  const benefs = [...porBenef.values()]
  const head = `<thead><tr><th></th>${MESES.map((m) => `<th>${NOME[m]}</th>`).join('')}<th class="total">Total</th></tr></thead>`

  const pagina = (titulo: string, corpo: string, n: number) => `
<div class="pagina">
  <header><div class="marca">ANNONAE</div><div class="lema">Banco de Alimentos · São João del Rei/MG</div>
  <div class="periodo">Relatório Trimestral · Julho a Setembro de 2026 · ${titulo}</div></header>
  <main>${corpo}</main>
  <footer><span>Dados do sistema Annonae · 14 semanas de distribuição (01/07 a 06/10/2026)</span><span>Pág. ${n}/3 · Emitido em ${EMISSAO}</span></footer>
</div>`

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Annonae · Relatório Jul–Set/2026</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--oliva:#4F5D2F;--oliva-esc:#343E1F;--terracota:#B5562B;--ouro:#C9A227;--creme:#F7F2E7;--tinta:#2B2B2B;--cinza:#6B6B6B}
@page{size:A4;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Inter,sans-serif;background:var(--creme);color:var(--tinta);padding:20px}
.pagina{max-width:190mm;margin:0 auto 20px;background:#fff;border-top:6px solid var(--oliva);box-shadow:0 4px 20px rgba(0,0,0,.08);page-break-after:always}
.pagina:last-child{page-break-after:auto}
header{padding:16px 28px;background:var(--oliva);color:var(--creme);position:relative}
header::after{content:"";position:absolute;left:0;right:0;bottom:-5px;height:5px;background:repeating-linear-gradient(90deg,var(--ouro) 0 16px,transparent 16px 22px)}
.marca{font-family:Cinzel,serif;font-size:24px;letter-spacing:4px}
.lema{font-size:11px;letter-spacing:2px;opacity:.85;text-transform:uppercase}
.periodo{margin-top:6px;font-size:13px;font-weight:600;color:var(--ouro)}
main{padding:18px 28px 8px}
h2{font-family:Cinzel,serif;color:var(--oliva-esc);font-size:13px;letter-spacing:2px;margin:0 0 8px;padding-bottom:4px;border-bottom:2px solid var(--ouro)}
section{margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:11.5px}
th{background:var(--oliva);color:var(--creme);font-weight:600;padding:6px 8px;text-align:right}
th:first-child,td:first-child{text-align:left}
td{padding:5px 8px;text-align:right;border-bottom:1px solid #E5DCC5;vertical-align:top;white-space:nowrap}
td:first-child{white-space:normal}
tr:nth-child(even) td{background:var(--creme)}
td.total,th.total{font-weight:700;color:var(--oliva-esc);background:#EFE6CF}
tr.rodape td{font-weight:700;background:var(--oliva-esc)!important;color:var(--creme)}
.desc{font-size:9.5px;color:var(--cinza);margin-top:2px;max-width:230px}
.nota{font-size:10px;color:var(--cinza);margin-top:6px}
footer{padding:8px 28px;background:var(--creme);font-size:9.5px;color:var(--cinza);display:flex;justify-content:space-between;border-top:1px solid #E5DCC5}
@media print{body{padding:0;background:#fff}.pagina{box-shadow:none;max-width:none;margin:0}}
</style></head><body>
${pagina('Resumo mensal', `
<section><h2>PESOS E CESTAS POR MÊS</h2><table>${head}<tbody>${tabelaMes}</tbody></table></section>
<section><h2>DOAÇÕES RECEBIDAS POR ORIGEM</h2><table>${head}<tbody>${tabelaOrigem}</tbody></table>
<p class="nota">Origem conforme registrada em cada doação no sistema.</p></section>`, 1)}
${pagina('Instituições', `
<section><h2>KG RECEBIDOS POR INSTITUIÇÃO</h2><table>${head}<tbody>${tabelaBenef(benefs.filter((b) => !b.cras))}</tbody></table>
<p class="nota">Soma dos itens em kg das distribuições a cada instituição, por mês de distribuição. "—" = sem entrega no mês.</p></section>`, 2)}
${pagina('CRAS', `
<section><h2>KG RECEBIDOS POR CRAS</h2><table>${head}<tbody>${tabelaBenef(benefs.filter((b) => b.cras))}</tbody></table>
<p class="nota">Esses quilos chegaram às famílias em ${int(soma(cestas))} cestas, média de ${kg(mediaTri)} por cesta.</p></section>`, 3)}
</body></html>`

  writeFileSync('relatorio-jul-set-2026.html', html, 'utf8')

  console.log('\n✅ relatorio-jul-set-2026.html gerado')
  console.table({
    'Total distribuído (14 semanas)': kg(soma(distrib)),
    'Total distribuído (até 30/09, critério antigo)': kg(kgAte30set),
    'Diferença (01 a 06/10)': kg(soma(distrib) - kgAte30set),
    'Instituições': benefs.filter((b) => !b.cras).length,
    'CRAS': benefs.filter((b) => b.cras).length,
    'Itens fora de kg (não somados)': foraKg,
  })
}

main()
  .catch((e) => (console.error(e), process.exit(1)))
  .finally(() => prisma.$disconnect())
