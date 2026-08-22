import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import {
  canEdit,
  canEditRecord,
  canView,
  canDeleteRecord,
  canRegisterRecebimento,
  canCalibrateStock,
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
 * 🆕 ONDA 22 — Gate genérico por lista de roles.
 *
 * Substitui os checks manuais espalhados pelas rotas
 * (`if (!rolesPermitidos.includes(session.user.role))`).
 * Fail-secure: role ausente ou inválido → 403.
 */
export async function requireRole(
  roles: readonly UserRole[],
): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  const role = result.user.role
  if (!role || !roles.includes(role)) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  return result
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

/**
 * 🆕 ONDA 17.3 — Garante que o usuário pode REGISTRAR recebimentos
 * em eventos (admin OU operador — Opção A).
 *
 * A trava de status ATIVO do evento é feita na rota de recebimento,
 * após buscar o evento no banco.
 */
export async function requireRegisterRecebimento(): Promise<
  AuthSession | NextResponse
> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!canRegisterRecebimento(result.user.role)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para registrar recebimentos' },
      { status: 403 },
    )
  }
  return result
}

/**
 * 🆕 Garante que o usuário é dev OU admin.
 * Útil para ações estruturais que dev e admin compartilham.
 */
export async function requireAdminOrDev(): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (result.user.role !== 'dev' && result.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Apenas administradores podem realizar esta ação' },
      { status: 403 },
    )
  }
  return result
}

/**
 * 🔒 Garante que o usuário é DEV.
 * Ações irreversíveis / dados crus sensíveis.
 */
export async function requireDev(): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (result.user.role !== 'dev') {
    return NextResponse.json(
      { error: 'Apenas o perfil dev pode realizar esta ação' },
      { status: 403 },
    )
  }
  return result
}

/**
 * 🆕 ONDA 17-C — Garante que o usuário pode CALIBRAR estoque (Marco Zero).
 * 🔒 Exclusivo do dev.
 */
export async function requireCalibrateStock(): Promise<AuthSession | NextResponse> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  if (!canCalibrateStock(result.user.role)) {
    return NextResponse.json(
      { error: 'Apenas o perfil dev pode calibrar o estoque' },
      { status: 403 },
    )
  }
  return result
}
