'use client'

import useSWR, { SWRConfiguration, mutate as globalMutate } from 'swr'

/**
 * 🔄 Fetcher padrão — usado por todos os hooks de cache
 */
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('Erro ao buscar dados')
    throw error
  }
  return res.json()
}

/**
 * 🎯 Hook genérico de cache de API.
 *
 * - Cache automático em memória (compartilhado entre todas as páginas)
 * - Revalida ao focar a janela
 * - Revalida ao reconectar internet
 * - Dedup de requests (se 3 componentes pedirem ao mesmo tempo, faz 1 request só)
 *
 * @param key URL da API ou null pra desabilitar
 * @param config Override opcional de configuração SWR
 */
export function useApi<T = unknown>(
  key: string | null,
  config?: SWRConfiguration
) {
  const { data, error, isLoading, mutate } = useSWR<T>(key, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // 5s — não refaz request idêntico nesse intervalo
    ...config,
  })

  return {
    data,
    error,
    isLoading,
    mutate, // 🔄 chama pra forçar refresh
  }
}

/**
 * 🌍 Helper pra invalidar uma chave globalmente (de qualquer lugar do app).
 *
 * Uso: depois de criar/editar/excluir uma doação, chama:
 *   invalidate('/api/doacoes')
 *
 * Isso força todos os componentes que usam essa chave a refazer o fetch.
 */
export function invalidate(key: string) {
  return globalMutate(key)
}
