import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  canEdit,
  canEditRecord,
  canView,
  canDeleteRecord,
  type Module,
} from './permissions'
import type { UserRole } from '@/types/next-auth'

export type AuthSession = {
  user: {
    id: string
    role: UserRole
    name?: string | null
    email?: string | null
  }
}

/**
 * Garante que há uma sessão válida. Retorna a sessão ou uma Response 401.
 *
 * Uso:
 *   const auth = await requireAuth()
 *   if (auth instanceof NextResponse) return auth
 *   // auth.user.id, auth.user.role disponíveis
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      { status: 401 },
    )
  }
  return session as AuthSession
}

/**
 * Garante que o usuário tem permissão de VISUALIZAR o módulo.
 */
export async function requireView(
  module: Module,
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!canView(result.user.role, module)) {
    return NextResponse.json(
      { error: 'Acesso negado a este módulo' },
      { status: 403 },
    )
  }
  return result
}

/**
 * Garante que o usuário tem permissão de EDITAR o módulo.
 * Para módulos time-locked, use também requireEditRecord().
 */
export async function requireEdit(
  module: Module,
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!canEdit(result.user.role, module)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para modificar este módulo' },
      { status: 403 },
    )
  }
  return result
}

/**
 * Garante que o usuário pode editar/excluir um REGISTRO específico,
 * respeitando a trava temporal de operador em módulos time-locked.
 */
export async function requireEditRecord(
  module: Module,
  recordCreatedAt: Date | string,
): Promise<AuthSession | NextResponse> {
  const result = await requireEdit(module)
  if (result instanceof NextResponse) return result
  if (!canEditRecord(result.user.role, module, recordCreatedAt)) {
    return NextResponse.json(
      {
        error:
          'Registros de dias anteriores não podem ser modificados. Contate um administrador.',
      },
      { status: 403 },
    )
  }
  return result
}

/**
 * 🚫 Garante que o usuário pode EXCLUIR registros do módulo.
 *
 * Em módulos time-locked (doações, distribuições, colheita), apenas admin
 * pode excluir — operador é sempre bloqueado, mesmo no mesmo dia.
 * Em módulos comuns, segue a regra de canEdit.
 */
export async function requireDeleteRecord(
  module: Module,
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!canDeleteRecord(result.user.role, module)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para excluir este registro' },
      { status: 403 },
    )
  }
  return result
}

/**
 * Garante que o usuário é admin (útil pra /api/usuarios).
 */
export async function requireAdmin(): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (result.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas administradores podem realizar esta ação' },
      { status: 403 },
    )
  }
  return result
}
