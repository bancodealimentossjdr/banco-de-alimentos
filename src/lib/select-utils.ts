export function comSelecionado<T extends { id: string }>(
  ativos: T[],
  todos: T[],
  selecionadoId: string,
): T[] {
  if (!selecionadoId) return ativos
  if (ativos.some(i => i.id === selecionadoId)) return ativos
  const inativo = todos.find(i => i.id === selecionadoId)
  return inativo ? [...ativos, inativo] : ativos
}

/** Sufixo visual " (inativo)" — aceita qualquer objeto (fallbacks sem active/status) */
export function sufixoInativo(item: unknown): string {
  if (typeof item !== 'object' || item === null) return ''
  const o = item as { active?: unknown; status?: unknown }
  if (o.active === false) return ' (inativo)'
  if (typeof o.status === 'string' && o.status !== 'ativo') return ' (inativo)'
  return ''
}
