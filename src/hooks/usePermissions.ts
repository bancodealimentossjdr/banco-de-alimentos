'use client'

import { useSession } from 'next-auth/react'

export type Role = 'admin' | 'operador' | 'visualizador'

// Módulos que admin + operador podem editar (operação diária)
const OPERATIONAL_MODULES = ['doacoes', 'distribuicoes', 'colheita-solidaria'] as const

// Módulos que SÓ admin pode editar (cadastros estruturais)
const ADMIN_ONLY_MODULES = [
  'produtos',
  'doadores',
  'beneficiarios',
  'funcionarios',
  'produtores',
  'usuarios',
] as const

export type Module =
  | (typeof OPERATIONAL_MODULES)[number]
  | (typeof ADMIN_ONLY_MODULES)[number]

export function usePermissions() {
  const { data: session, status } = useSession()

  const role = (session?.user?.role as Role | undefined) ?? 'visualizador'
  const isAdmin = role === 'admin'
  const isOperador = role === 'operador'
  const isVisualizador = role === 'visualizador'
  const isLoading = status === 'loading'

  /**
   * Verifica se o usuário pode CRIAR/EDITAR/EXCLUIR em um módulo.
   * - admin: todos os módulos
   * - operador: apenas módulos operacionais
   * - visualizador: nenhum
   */
  const canEdit = (module: Module): boolean => {
    if (isVisualizador) return false
    if (isAdmin) return true
    // operador
    return (OPERATIONAL_MODULES as readonly string[]).includes(module)
  }

  /**
   * Visualizar é liberado para todos os roles autenticados.
   */
  const canView = (_module: Module): boolean => {
    return !!session
  }

  return {
    role,
    isAdmin,
    isOperador,
    isVisualizador,
    isLoading,
    canEdit,
    canView,
  }
}
