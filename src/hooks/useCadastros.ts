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
 * 🛒 Lista de produtos cadastrados
 */
export function useProdutos() {
  const { data, error, isLoading, mutate } = useApi<Product[]>(
    '/api/produtos',
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
export function useDoadores() {
  const { data, error, isLoading, mutate } = useApi<Donor[]>(
    '/api/doadores',
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
export function useBeneficiarios() {
  const { data, error, isLoading, mutate } = useApi<Beneficiary[]>(
    '/api/beneficiarios',
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
export function useFuncionarios() {
  const { data, error, isLoading, mutate } = useApi<Employee[]>(
    '/api/funcionarios',
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
export function useProdutores() {
  const { data, error, isLoading, mutate } = useApi<Producer[]>(
    '/api/produtores',
    CADASTRO_CONFIG
  )
  return {
    produtores: data ?? [],
    error,
    isLoading,
    mutate,
  }
}