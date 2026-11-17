// src/lib/serie-mensal.ts
// 📜 Planilha (historico_mensal) — fonte única da Regra B fora do painel.
import { prisma } from '@/lib/prisma'
import { startOfDayBrasilia } from '@/lib/date/day-boundaries'

export type LegadoMes = { DOACAO: number; COLHEITA: number; DISTRIBUICAO: number }

/** Chave "YYYY-MM" a partir de ano e mês 0-based. */
export function chaveMes(y: number, m0: number): string {
  return `${y}-${String(m0 + 1).padStart(2, '0')}`
}

/** Mês civil de Brasília para colunas DateTime. */
export function chaveMesDateTime(d: Date): string {
  const s = startOfDayBrasilia(d)
  return chaveMes(s.getUTCFullYear(), s.getUTCMonth())
}

/** Mês civil para colunas @db.Date (sem offset). */
export function chaveMesDateOnly(d: Date): string {
  return chaveMes(d.getUTCFullYear(), d.getUTCMonth())
}

/** Todos os meses que o período toca (opção b: mês tocado entra inteiro). */
export function mesesTocados(from: Date, to: Date): string[] {
  const f = startOfDayBrasilia(from)
  const t = startOfDayBrasilia(to)
  let y = f.getUTCFullYear()
  let m = f.getUTCMonth()
  const yEnd = t.getUTCFullYear()
  const mEnd = t.getUTCMonth()
  const out: string[] = []
  while (y < yEnd || (y === yEnd && m <= mEnd)) {
    out.push(chaveMes(y, m))
    m++
    if (m > 11) { m = 0; y++ }
  }
  return out
}

/** Soma da planilha por mês. Se a tabela falhar, segue sem legado. */
export async function buscarLegadoPorMes(meses: string[]): Promise<Map<string, LegadoMes>> {
  const map = new Map<string, LegadoMes>()
  if (meses.length === 0) return map
  const anos = [...new Set(meses.map((k) => Number(k.slice(0, 4))))]
  const alvo = new Set(meses)
  try {
    const rows = await prisma.historicoMensal.groupBy({
      by: ['ano', 'mes', 'tipo'],
      where: { ano: { in: anos }, tipo: { in: ['DOACAO', 'COLHEITA', 'DISTRIBUICAO'] } },
      _sum: { kg: true },
    })
    for (const r of rows) {
      const key = chaveMes(Number(r.ano), Number(r.mes) - 1) // mes na tabela = 1..12
      if (!alvo.has(key)) continue
      const e = map.get(key) ?? { DOACAO: 0, COLHEITA: 0, DISTRIBUICAO: 0 }
      e[r.tipo as keyof LegadoMes] += Number(r._sum.kg ?? 0)
      map.set(key, e)
    }
  } catch (error) {
    console.error('[serie-mensal] historico_mensal indisponível, seguindo sem legado:', error)
  }
  return map
}

/** ⚖️ Regra B: por mês e tipo, a planilha prevalece; sem planilha, usa o app. Nunca soma. */
export function escolher(leg: number, app: number): number {
  return leg > 0 ? leg : app
}

export function mesTemPlanilha(l?: LegadoMes): boolean {
  return !!l && (l.DOACAO > 0 || l.COLHEITA > 0 || l.DISTRIBUICAO > 0)
}

/** Mês com doação/colheita da planilha não entra em Aproveitamento % nem perda. */
export function mesSemTaxa(l?: LegadoMes): boolean {
  return !!l && (l.DOACAO > 0 || l.COLHEITA > 0)
}
