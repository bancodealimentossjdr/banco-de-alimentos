import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

const LIMITE_RENDA = 810.55
const LIMITE_LISTA = 20 // 🆕 últimos 20 registros

/** Mascara CPF (11 dígitos) → ***.***.789-** */
function mascararCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return '***.***.***-**'
  return `***.***.${d.slice(6, 9)}-**`
}

/** Mascara código familiar → mostra últimos 3, resto vira • */
function mascararCodigo(codigo: string): string {
  const c = codigo.trim()
  if (c.length <= 3) return c
  return '•'.repeat(c.length - 3) + c.slice(-3)
}

/**
 * 🆕 Folha Resumo — Ingresso social por família num evento.
 * POST → registra retirada (dev/admin/operador + visualizador com vínculo).
 * GET  → lista registros (dev/admin/operador + visualizador com vínculo).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1️⃣ Autenticação
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const registradoPor = result.user.id
  const role = result.user.role

  const { id: eventoId } = await params

  // 2️⃣ Parse do body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { codigoFamiliar, cpf, rendaPerCapita } = (body ?? {}) as {
    codigoFamiliar?: string
    cpf?: string
    rendaPerCapita?: number | string
  }

  // 3️⃣ Validações de campo
  const codigo = typeof codigoFamiliar === 'string' ? codigoFamiliar.trim() : ''
  if (!codigo) {
    return NextResponse.json(
      { error: 'Código familiar é obrigatório' },
      { status: 400 },
    )
  }

  const cpfLimpo =
    typeof cpf === 'string' && cpf.replace(/\D/g, '').length === 11
      ? cpf.replace(/\D/g, '')
      : null
  if (!cpfLimpo) {
    return NextResponse.json(
      { error: 'CPF inválido (precisa ter 11 dígitos)' },
      { status: 400 },
    )
  }

  const renda = Number(rendaPerCapita)
  if (!Number.isFinite(renda) || renda < 0) {
    return NextResponse.json(
      { error: 'Renda per capita inválida' },
      { status: 400 },
    )
  }

  // 3️⃣.5 🚫 TRAVA DE RENDA (bloqueia envio no servidor)
  if (renda > LIMITE_RENDA) {
    return NextResponse.json(
      {
        error: `Renda per capita (R$ ${renda.toFixed(
          2,
        )}) acima do limite de R$ ${LIMITE_RENDA.toFixed(
          2,
        )}. Família não elegível ao ingresso social.`,
      },
      { status: 422 },
    )
  }

  // 4️⃣ Evento existe e está ATIVO
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  if (evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Só é possível registrar ingressos em eventos ATIVOS' },
      { status: 409 },
    )
  }

  // 5️⃣ Gate de registro por evento (mesmo padrão dos recebimentos)
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId: registradoPor } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para registrar ingressos neste evento' },
      { status: 403 },
    )
  }

  // 6️⃣ Persiste (trata duplicata via @@unique)
  try {
    const criado = await prisma.folhaResumoIngresso.create({
      data: {
        eventoId,
        codigoFamiliar: codigo,
        cpf: cpfLimpo, // cru no banco (auditoria); mascarado só no GET
        rendaPerCapita: new Prisma.Decimal(renda),
        registradoPor,
      },
      select: { id: true, codigoFamiliar: true, createdAt: true },
    })

    return NextResponse.json({ ok: true, ingresso: criado }, { status: 201 })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Este código familiar já retirou o ingresso social neste evento' },
        { status: 409 },
      )
    }
    throw err
  }
}

/**
 * GET → lista os últimos 20 ingressos do evento.
 * Acesso: dev/admin/operador + visualizador COM vínculo ativo.
 * CPF e código familiar sempre mascarados; renda em valor cheio.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const role = result.user.role
  const userId = result.user.id

  const { id: eventoId } = await params

  // 🔒 Autorização (defesa no servidor)
  // dev/admin/operador entram direto; visualizador só com vínculo ativo.
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para ver a folha resumo deste evento' },
      { status: 403 },
    )
  }

  const registros = await prisma.folhaResumoIngresso.findMany({
    where: { eventoId },
    orderBy: { createdAt: 'desc' },
    take: LIMITE_LISTA, // 🆕 últimos 20
    select: {
      id: true,
      codigoFamiliar: true,
      cpf: true,
      rendaPerCapita: true,
      createdAt: true,
    },
  })

  // Mascara CPF + código familiar na saída (renda cheia)
  const lista = registros.map((r) => ({
    id: r.id,
    codigoFamiliar: mascararCodigo(r.codigoFamiliar),
    cpf: mascararCpf(r.cpf),
    rendaPerCapita: Number(r.rendaPerCapita),
    createdAt: r.createdAt,
  }))

  return NextResponse.json({ total: lista.length, registros: lista })
}
/**
 * DELETE → remove um ingresso da folha resumo. SÓ dev.
 * Body: { registroId: string }
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const role = result.user.role

  // 🔒 apenas dev pode excluir
  if (role !== 'dev') {
    return NextResponse.json(
      { error: 'Apenas o desenvolvedor pode excluir registros da folha resumo' },
      { status: 403 },
    )
  }

  const { id: eventoId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { registroId } = (body ?? {}) as { registroId?: string }
  if (!registroId || typeof registroId !== 'string') {
    return NextResponse.json({ error: 'registroId é obrigatório' }, { status: 400 })
  }

  try {
    await prisma.folhaResumoIngresso.delete({
      where: { id: registroId, eventoId }, // garante que é do evento certo
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }
    throw err
  }
}
