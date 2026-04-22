import type { UserRole } from '@/types/next-auth'
import { maskCPF, maskPhone, maskEmail, maskAddress, maskContactName } from './mask'
import { canEdit, type Module } from './permissions'

/**
 * Retorna true se o role deve ver dados mascarados.
 * Hoje: apenas visualizador. Admin e operador veem tudo.
 */
export function shouldMaskPersonalData(role: UserRole | undefined | null): boolean {
  return role === 'visualizador'
}

// ---------- DOADOR ----------
type DoadorLike = {
  contact?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  [key: string]: unknown
}

export function maskDoador<T extends DoadorLike>(doador: T, role: UserRole | undefined | null): T {
  if (!shouldMaskPersonalData(role)) return doador
  return {
    ...doador,
    contact: maskContactName(doador.contact ?? null),
    phone: maskPhone(doador.phone ?? null),
    email: maskEmail(doador.email ?? null),
    address: maskAddress(doador.address ?? null),
  }
}

export function maskDoadorList<T extends DoadorLike>(list: T[], role: UserRole | undefined | null): T[] {
  if (!shouldMaskPersonalData(role)) return list
  return list.map((d) => maskDoador(d, role))
}

// ---------- BENEFICIÁRIO (instituição) ----------
type BeneficiarioLike = {
  phone?: string | null
  address?: string | null
  contact?: string | null
  notes?: string | null
  [key: string]: unknown
}

export function maskBeneficiario<T extends BeneficiarioLike>(
  b: T,
  role: UserRole | undefined | null
): T {
  if (!shouldMaskPersonalData(role)) return b
  return {
    ...b,
    phone: maskPhone(b.phone ?? null),
    address: maskAddress(b.address ?? null),
    contact: maskContactName(b.contact ?? null),
    // notes pode conter dados sensíveis livres → ocultar completamente
    notes: b.notes ? '*** (informações restritas)' : b.notes,
  }
}

export function maskBeneficiarioList<T extends BeneficiarioLike>(
  list: T[],
  role: UserRole | undefined | null
): T[] {
  if (!shouldMaskPersonalData(role)) return list
  return list.map((b) => maskBeneficiario(b, role))
}

// ---------- PRODUTOR RURAL ----------
type ProdutorLike = {
  phone?: string | null
  email?: string | null
  address?: string | null
  contact?: string | null
  cpf?: string | null
  [key: string]: unknown
}

export function maskProdutor<T extends ProdutorLike>(
  p: T,
  role: UserRole | undefined | null
): T {
  if (!shouldMaskPersonalData(role)) return p
  return {
    ...p,
    phone: maskPhone(p.phone ?? null),
    email: maskEmail(p.email ?? null),
    address: maskAddress(p.address ?? null),
    contact: maskContactName(p.contact ?? null),
    cpf: maskCPF(p.cpf ?? null),
  }
}

export function maskProdutorList<T extends ProdutorLike>(
  list: T[],
  role: UserRole | undefined | null
): T[] {
  if (!shouldMaskPersonalData(role)) return list
  return list.map((p) => maskProdutor(p, role))
}

// ---------- Helpers por módulo (notes em somente-leitura) ----------

/**
 * Retorna true se o role é "somente leitura" no módulo.
 * Usado para mascarar campos de texto livre (ex: notes) em módulos
 * operacionais (doações, distribuições, colheita) onde o visualizador
 * tem acesso de leitura mas não deve ver detalhes sensíveis.
 */
export function isReadOnlyInModule(
  role: UserRole | undefined | null,
  module: Module
): boolean {
  if (!role) return true
  return !canEdit(role, module)
}

/**
 * Mascara o campo `notes` se o role for somente leitura no módulo.
 */
export function maskNotesIfReadOnly<T extends { notes?: string | null }>(
  item: T,
  role: UserRole | undefined | null,
  module: Module
): T {
  if (!isReadOnlyInModule(role, module)) return item
  if (!item.notes) return item
  return { ...item, notes: '*** (informações restritas)' }
}

export function maskNotesListIfReadOnly<T extends { notes?: string | null }>(
  list: T[],
  role: UserRole | undefined | null,
  module: Module
): T[] {
  if (!isReadOnlyInModule(role, module)) return list
  return list.map((item) => maskNotesIfReadOnly(item, role, module))
}

// ---------- Re-exports ----------
export { maskCPF, maskPhone, maskEmail, maskAddress, maskContactName }
