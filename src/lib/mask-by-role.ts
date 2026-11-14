import type { UserRole } from '@/types/next-auth'
import { maskCPF, maskPhone, maskEmail, maskAddress, maskContactName } from './mask'
import { canEdit, type Module } from './permissions'

/**
 * Retorna true se o role deve ver dados de CONTATO mascarados.
 *
 * Política:
 * - dev / admin / operador → veem dados crus
 * - visualizador           → vê dados mascarados
 *
 * 🛡️ Fail-secure: sem role (sessão inválida, token corrompido) → MASCARA.
 * É mais seguro vazar nada do que vazar tudo.
 */
export function shouldMaskPersonalData(role: UserRole | undefined | null): boolean {
  if (!role) return true
  return role !== 'dev' && role !== 'admin' && role !== 'operador'
}

/**
 * Retorna true se o role deve ver DOCUMENTOS (CPF, CAF/DAP) mascarados.
 *
 * Política (decisão travada 23.9a):
 * - dev / admin            → veem documentos crus (emitem o Termo PAA)
 * - operador / visualizador → mascarados
 *
 * 🛡️ Motivo: minimização de dados (LGPD art. 6º, III). O operador lança
 * entregas e colhe assinaturas usando nome, telefone e endereço; CPF e
 * CAF só são necessários no PDF do Termo, gerado por admin/dev.
 * 🛡️ Fail-secure: sem role → MASCARA.
 */
export function shouldMaskDocumentos(role: UserRole | undefined | null): boolean {
  if (!role) return true
  return role !== 'dev' && role !== 'admin'
}

/**
 * 🛡️ 23.9a — CAF/DAP: mantém só os 4 últimos caracteres.
 * "SDW0123456789" → "****6789"
 */
export function maskDapCaf(v: string | null | undefined): string | null {
  if (!v) return null
  const limpo = v.trim()
  if (limpo.length <= 4) return '****'
  return `****${limpo.slice(-4)}`
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
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  contact?: string | null
  cpf?: string | null
  dapCaf?: string | null
  [key: string]: unknown
}

/**
 * Mascara dados do produtor rural em duas camadas independentes.
 *
 * 🎭 Política:
 * | Campo                                  | Visualizador | Operador | Admin/Dev |
 * |----------------------------------------|--------------|----------|-----------|
 * | name, contact, phone, email, address   | mascarado    | visível  | visível   |
 * | cpf, dapCaf                            | mascarado    | mascarado| visível   |
 *
 * 🛡️ Motivo (contato): na colheita solidária, o nome do produtor revela
 * quem entregou, quando e em que volume. O visualizador não deve acessar
 * isso de forma identificável. O operador precisa de telefone e endereço
 * na operação diária.
 * 🛡️ Motivo (documentos): ver shouldMaskDocumentos.
 * 🛡️ Só mascara documentos que EXISTEM no objeto: se o endpoint usa
 * `select` sem cpf/dapCaf, eles não são criados.
 * ⚠️ Não percorre include aninhado: cada rota deve chamar
 * maskProdutor(entrega.producer, role) explicitamente.
 */
export function maskProdutor<T extends ProdutorLike>(
  p: T,
  role: UserRole | undefined | null
): T {
  const maskContato = shouldMaskPersonalData(role)
  const maskDocs = shouldMaskDocumentos(role)
  if (!maskContato && !maskDocs) return p

  return {
    ...p,
    ...(maskContato
      ? {
          name: maskContactName(p.name ?? null),
          phone: maskPhone(p.phone ?? null),
          email: maskEmail(p.email ?? null),
          address: maskAddress(p.address ?? null),
          contact: maskContactName(p.contact ?? null),
        }
      : {}),
    ...(maskDocs && 'cpf' in p ? { cpf: maskCPF(p.cpf ?? null) } : {}),
    ...(maskDocs && 'dapCaf' in p ? { dapCaf: maskDapCaf(p.dapCaf) } : {}),
  }
}

export function maskProdutorList<T extends ProdutorLike>(
  list: T[],
  role: UserRole | undefined | null
): T[] {
  if (!shouldMaskPersonalData(role) && !shouldMaskDocumentos(role)) return list
  return list.map((p) => maskProdutor(p, role))
}

// ---------- FUNCIONÁRIO ----------
type FuncionarioLike = {
  name?: string | null
  phone?: string | null
  [key: string]: unknown
}

/**
 * Mascara dados do funcionário para perfil visualizador.
 * - name/phone mascarados; role/cargo e active permanecem visíveis
 *   (informação operacional pública).
 *
 * 🛡️ Motivo: o ranking de funcionários não deve ser exposto ao
 * visualizador, portanto até o nome é dado sensível neste contexto.
 */
export function maskFuncionario<T extends FuncionarioLike>(
  f: T,
  role: UserRole | undefined | null
): T {
  if (!shouldMaskPersonalData(role)) return f
  return {
    ...f,
    name: maskContactName(f.name ?? null),
    phone: maskPhone(f.phone ?? null),
  }
}

export function maskFuncionarioList<T extends FuncionarioLike>(
  list: T[],
  role: UserRole | undefined | null
): T[] {
  if (!shouldMaskPersonalData(role)) return list
  return list.map((f) => maskFuncionario(f, role))
}

// ---------- Helpers por módulo (notes em somente-leitura) ----------

/**
 * Retorna true se o role é "somente leitura" no módulo.
 * Usado para mascarar texto livre (notes) em módulos operacionais
 * (doações, distribuições, colheita), onde o visualizador lê mas não
 * deve ver detalhes sensíveis.
 *
 * 🛡️ Fail-secure: sem role = somente leitura.
 */
export function isReadOnlyInModule(
  role: UserRole | undefined | null,
  module: Module
): boolean {
  if (!role) return true
  return !canEdit(role, module)
}

/** Mascara o campo `notes` se o role for somente leitura no módulo. */
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

// ---------- ONDA 23 — ENTREGA PAA ----------
type EntregaPaaLike = {
  valorTotal?: unknown
  itens?: { precoUnitario?: unknown; subtotal?: unknown; [k: string]: unknown }[]
  [key: string]: unknown
}

/**
 * 🎭 Mascara valores financeiros individualizados da entrega PAA.
 *
 * Política (decidida na 23.3):
 * - Preço de tabela CONAB no CADASTRO de produto → público
 * - valorTotal / subtotal / precoUnitario da ENTREGA → financeiro
 *   individualizado do produtor → mascarado para visualizador
 * - pesoKg / pesoTotalKg / quantidade → VISÍVEIS (dado operacional)
 */
export function maskEntregaPaa<T extends EntregaPaaLike>(
  e: T,
  role: UserRole | undefined | null
): T {
  if (!shouldMaskPersonalData(role)) return e
  return {
    ...e,
    valorTotal: null,
    isMasked: true,
    itens: Array.isArray(e.itens)
      ? e.itens.map((i) => ({ ...i, precoUnitario: null, subtotal: null }))
      : e.itens,
  }
}

export function maskEntregaPaaList<T extends EntregaPaaLike>(
  list: T[],
  role: UserRole | undefined | null
): T[] {
  if (!shouldMaskPersonalData(role)) return list
  return list.map((e) => maskEntregaPaa(e, role))
}

// ---------- Re-exports ----------
export { maskCPF, maskPhone, maskEmail, maskAddress, maskContactName }
