'use client'

import { useApi } from './useApi'

interface Product { id: string; name: string; unit: string }
interface Donor { id: string; name: string }
interface Beneficiary { id: string; name: string }
interface Employee { id: string; name: string }
interface Producer { id: string; name: string }

/**
 * 📦 Cache de cadastros (dados estruturais que mudam pouco)
 *
 * - Cache de 60s — não refaz request por 1 minuto
 * - Compartilhado entre TODAS as páginas que usam o hook
 * - Revalida em background ao focar a janela
 */
const CADASTRO_CONFIG = {
  dedupingInterval: 60_000, // 1 minuto — cadastros mudam raramente
  revalidateOnFocus: true,
}

/**
 * 🔧 Opções comuns a todos os hooks de cadastro.
 *
 * @property enabled Se `false`, o fetch é PULADO (key vira null no SWR).
 *                   Use para evitar 403 quando o usuário não tem permissão
 *                   de leitura no recurso (ex.: Visualizador).
 *                   Default: true.
 */
interface CadastroOptions {
  enabled?: boolean
}

/**
 * 🛒 Lista de produtos cadastrados
 */
export function useProdutos({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Product[]>(
    enabled ? '/api/produtos' : null,
    CADASTRO_CONFIG
  )
  return {
    produtos: data ?? [],
    error,
    isLoading,
    mutate,
  }
}

/**
 * 🏪 Lista de doadores
 */
export function useDoadores({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Donor[]>(
    enabled ? '/api/doadores' : null,
    CADASTRO_CONFIG
  )
  return {
    doadores: data ?? [],
    error,
    isLoading,
    mutate,
  }
}

/**
 * 👥 Lista de beneficiários
 */
export function useBeneficiarios({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Beneficiary[]>(
    enabled ? '/api/beneficiarios' : null,
    CADASTRO_CONFIG
  )
  return {
    beneficiarios: data ?? [],
    error,
    isLoading,
    mutate,
  }
}

/**
 * 🧑 Lista de funcionários
 */
export function useFuncionarios({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Employee[]>(
    enabled ? '/api/funcionarios' : null,
    CADASTRO_CONFIG
  )
  return {
    funcionarios: data ?? [],
    error,
    isLoading,
    mutate,
  }
}

/**
 * 🌾 Lista de produtores rurais
 */
export function useProdutores({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Producer[]>(
    enabled ? '/api/produtores' : null,
    CADASTRO_CONFIG
  )
  return {
    produtores: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
