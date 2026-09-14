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
 *
 * @property lookup  🆕 ONDA 23.7e-4 — pede o contrato ENXUTO da API
 *                   (`?lookup=1`): só `id` + `name`, sem `_count` nem
 *                   máscara, e liberado por canLookup() em vez de canView().
 *
 *                   Use em PÁGINAS DE LANÇAMENTO (doação, distribuição,
 *                   colheita, PAA). NÃO use em páginas de cadastro — elas
 *                   precisam do payload completo.
 *
 *                   ⚠️ `lookup` gera uma KEY SWR DIFERENTE. Isso é
 *                   intencional: o cache do lookup não pode se misturar com
 *                   o da tela de gestão, senão a página de cadastro herdaria
 *                   um payload sem os campos que ela renderiza.
 */
interface CadastroOptions {
  enabled?: boolean
  lookup?: boolean
}

/** Monta a URL do cadastro respeitando o modo lookup. */
function urlCadastro(base: string, { enabled = true, lookup = false }: CadastroOptions) {
  if (!enabled) return null
  return lookup ? `${base}?lookup=1` : base
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
 *
 * ⚠️ `produtos` NÃO tem modo lookup: não há dado sensível no cadastro de
 * produto e o payload já é enxuto. Aceita `lookup` só por simetria de API.
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
export function useDoadores(opts: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Donor[]>(
    urlCadastro('/api/doadores', opts),
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
 *
 * ⚠️ No modo lookup a API já devolve só os ativos — o filtro client-side
 * abaixo continua rodando e é inofensivo (idempotente).
 */
export function useBeneficiarios(opts: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Beneficiary[]>(
    urlCadastro('/api/beneficiarios', opts),
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
 *
 * 🆕 Em páginas de lançamento use `useFuncionarios({ lookup: true })`:
 * economiza 9 agregações `_count` por carga e dispensa canView('funcionarios').
 */
export function useFuncionarios(opts: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Employee[]>(
    urlCadastro('/api/funcionarios', opts),
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
export function useProdutores(opts: CadastroOptions = {}) {
  const { data, error, isLoading, mutate } = useApi<Producer[]>(
    urlCadastro('/api/produtores', opts),
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
