'use client'

import { useMemo } from 'react'
import { useApi } from './useApi'

interface Product { id: string; name: string; unit: string; active?: boolean }
interface Donor { id: string; name: string; active?: boolean }
interface Beneficiary { id: string; name: string; status?: string }
interface Employee { id: string; name: string; active?: boolean }
interface Producer { id: string; name: string; active?: boolean }

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
 * 🚦 SubOnda 2 — Filtro de ativos.
 *
 * Regra: um cadastro INATIVO não deve aparecer em NENHUM dropdown de
 * lançamento novo (doação, distribuição, colheita), mas o histórico e as
 * páginas de cadastro continuam mostrando tudo.
 *
 * ⚠️ Por que client-side e não `?apenasAtivos=1` na API:
 *   - a API é a MESMA usada pelas páginas de cadastro, que PRECISAM ver inativos
 *   - duas querystrings = duas keys no SWR = cache duplicado (perde o ganho)
 *
 * 🛡️ Fail-open intencional: se `active` vier `undefined` (registro legado,
 * campo ausente, máscara que não preservou), tratamos como ATIVO. É melhor
 * mostrar um item a mais do que esconder um doador válido em produção.
 */
function filtrarAtivos<T extends { active?: boolean }>(list: T[]): T[] {
  return list.filter(item => item.active !== false)
}

/**
 * 🛒 Lista de produtos cadastrados
 */
export function useProdutos({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Product[]>(
    enabled ? '/api/produtos' : null,
    CADASTRO_CONFIG
  )
  const todos = data ?? []
  const ativos = useMemo(() => filtrarAtivos(todos), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    /** ✅ Só ativos — use em dropdowns de lançamento */
    produtos: ativos,
    /** 📚 Tudo, inclusive inativos — use em telas de cadastro/histórico */
    produtosTodos: todos,
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
  const todos = data ?? []
  const ativos = useMemo(() => filtrarAtivos(todos), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    doadores: ativos,
    doadoresTodos: todos,
    error,
    isLoading,
    mutate,
  }
}

/**
 * 👥 Lista de beneficiários
 *
 * ⚠️ ATENÇÃO: o model Beneficiary NÃO tem `active: boolean`.
 * Ele usa `status: string` com valor 'ativo' (ver /api/beneficiarios).
 * Por isso o filtro aqui é diferente dos demais.
 */
export function useBeneficiarios({ enabled = true }: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Beneficiary[]>(
    enabled ? '/api/beneficiarios' : null,
    CADASTRO_CONFIG
  )
  const todos = data ?? []
  const ativos = useMemo(
    // fail-open: status ausente = considera ativo
    () => todos.filter(b => !b.status || b.status === 'ativo'),
    [data] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return {
    beneficiarios: ativos,
    beneficiariosTodos: todos,
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
  const todos = data ?? []
  const ativos = useMemo(() => filtrarAtivos(todos), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    funcionarios: ativos,
    funcionariosTodos: todos,
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
  const todos = data ?? []
  const ativos = useMemo(() => filtrarAtivos(todos), [data]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    produtores: ativos,
    produtoresTodos: todos,
    error,
    isLoading,
    mutate,
  }
}
