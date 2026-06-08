/**
 * 🇧🇷 Fronteiras de dia em horário de Brasília (UTC−3)
 *
 * Por que existe:
 *   - O servidor Vercel roda em UTC.
 *   - Os usuários operam em Brasília (UTC−3).
 *   - Cadastros feitos entre 21h e 23h59 (BSB) viram "dia seguinte" em UTC.
 *   - Filtros de período precisam respeitar a fronteira civil brasileira.
 *
 * O Brasil não usa mais horário de verão desde 2019 → offset fixo de 3h.
 *
 * Convenção:
 *   - "Início do dia DD/MM/YYYY em Brasília" = DD/MM/YYYY T03:00:00.000Z (UTC)
 *   - "Fim do dia DD/MM/YYYY em Brasília"    = (DD+1)/MM/YYYY T02:59:59.999Z (UTC)
 *
 * Uso típico:
 *   - parseYMDtoBrasiliaStart('2026-06-01')  → range gte
 *   - parseYMDtoBrasiliaEnd('2026-06-07')    → range lte
 *   - endOfDayBrasilia(marker.date)          → cutoff de marcos
 */

// Offset fixo de Brasília em milissegundos (UTC−3)
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000

/**
 * Retorna o instante UTC correspondente ao INÍCIO do dia (00:00:00.000)
 * em horário de Brasília para a data fornecida.
 *
 * Exemplo: input = Date qualquer no dia 2026-06-03
 *          output = 2026-06-03T03:00:00.000Z (= 00:00 BSB)
 */
export function startOfDayBrasilia(date: Date): Date {
  // 1. Converte para "civil BSB" subtraindo o offset
  const civil = new Date(date.getTime() - BRASILIA_OFFSET_MS)
  // 2. Pega ano/mês/dia em UTC (que agora representam o civil BSB)
  const y = civil.getUTCFullYear()
  const m = civil.getUTCMonth()
  const d = civil.getUTCDate()
  // 3. Reconstrói 00:00 BSB = 03:00 UTC
  return new Date(Date.UTC(y, m, d, 3, 0, 0, 0))
}

/**
 * Retorna o instante UTC correspondente ao FIM do dia (23:59:59.999)
 * em horário de Brasília para a data fornecida.
 *
 * Exemplo: input = Date qualquer no dia 2026-06-03
 *          output = 2026-06-04T02:59:59.999Z (= 23:59:59.999 BSB)
 */
export function endOfDayBrasilia(date: Date): Date {
  const civil = new Date(date.getTime() - BRASILIA_OFFSET_MS)
  const y = civil.getUTCFullYear()
  const m = civil.getUTCMonth()
  const d = civil.getUTCDate()
  // 23:59:59.999 BSB = 02:59:59.999 UTC do dia SEGUINTE
  return new Date(Date.UTC(y, m, d + 1, 2, 59, 59, 999))
}

/**
 * Converte string 'YYYY-MM-DD' (vinda de <input type="date">) para o
 * INÍCIO do dia em Brasília como Date UTC.
 *
 * Exemplo: '2026-06-01' → 2026-06-01T03:00:00.000Z
 */
export function parseYMDtoBrasiliaStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) {
    throw new Error(`Data inválida: "${ymd}". Esperado formato YYYY-MM-DD.`)
  }
  return new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0))
}

/**
 * Converte string 'YYYY-MM-DD' (vinda de <input type="date">) para o
 * FIM do dia em Brasília como Date UTC.
 *
 * Exemplo: '2026-06-07' → 2026-06-08T02:59:59.999Z
 */
export function parseYMDtoBrasiliaEnd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) {
    throw new Error(`Data inválida: "${ymd}". Esperado formato YYYY-MM-DD.`)
  }
  return new Date(Date.UTC(y, m - 1, d + 1, 2, 59, 59, 999))
}

/**
 * Converte uma Date para 'YYYY-MM-DD' representando o dia em Brasília.
 * Útil pra normalizar @db.Date que vem como meia-noite UTC.
 */
export function toYMDBrasilia(date: Date): string {
  const civil = new Date(date.getTime() - BRASILIA_OFFSET_MS)
  const y = civil.getUTCFullYear()
  const m = String(civil.getUTCMonth() + 1).padStart(2, '0')
  const d = String(civil.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
