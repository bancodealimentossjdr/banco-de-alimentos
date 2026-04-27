'use client'

import { useSession } from 'next-auth/react'
import {
  canView as libCanView,
  canEdit as libCanEdit,
  canEditRecord as libCanEditRecord,
  canDeleteRecord as libCanDeleteRecord,
  type Module,
  type Role,
} from '@/lib/permissions'

// Re-exporta os tipos pra manter compatibilidade
export type { Module, Role }

export function usePermissions() {
  const { data: session, status } = useSession()

  const role = (session?.user?.role as Role | undefined) ?? 'visualizador'
  const isAdmin = role === 'admin'
  const isOperador = role === 'operador'
  const isVisualizador = role === 'visualizador'
  const isLoading = status === 'loading'

  /**
   * Pode CRIAR no módulo? (não considera registro específico)
   * - admin: todos os módulos editáveis
   * - operador: apenas módulos operacionais
   * - visualizador: nenhum
   */
  const canEdit = (module: Module): boolean => {
    if (!session) return false
    return libCanEdit(role, module)
  }

  /**
   * Pode EDITAR um registro específico?
   * Admin: sempre. Operador: só se a data do registro for hoje (módulos time-locked).
   *
   * @param module - módulo do sistema
   * @param recordDate - campo `date` do registro
   */
  const canEditRecord = (module: Module, recordDate: Date | string): boolean => {
    if (!session) return false
    return libCanEditRecord(role, module, recordDate)
  }

  /**
   * Pode EXCLUIR registros desse módulo?
   * Para módulos time-locked: apenas admin.
   */
  const canDelete = (module: Module): boolean => {
    if (!session) return false
    return libCanDeleteRecord(role, module)
  }

  /**
   * Pode visualizar o módulo?
   */
  const canView = (module: Module): boolean => {
    if (!session) return false
    return libCanView(role, module)
  }

  return {
    role,
    isAdmin,
    isOperador,
    isVisualizador,
    isLoading,
    canEdit,
    canEditRecord,
    canDelete,
    canView,
  }
}
