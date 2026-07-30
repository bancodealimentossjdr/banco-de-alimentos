import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'

const LIMITE_RENDA = 810.55
const LIMITE_LISTA = 20

// 🎤 Line-up FIXO (mesmo value da arrecadação extra)
const SHOWS = [
  { value: 'hugo-guilherme-13', artista: 'Hugo e Guilherme', data: '13/08' },
  { value: 'ana-castela-14', artista: 'Ana Castela', data: '14/08' },
  { value: 'daniel-15', artista: 'Daniel', data: '15/08' },
  { value: 'mariana-fagundes-16', artista: 'Mariana Fagundes', data: '16/08' },
] as const

const SHOW_VALUES: Set<string> = new Set(SHOWS.map((s) => s.value))

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

/** Rótulo amigável do show */
function labelShow(v: string | null): string | null {
  if (!v) return null
  const s = SHOWS.find((x) => x.value === v)
  return s ? `${s.data} — ${s.artista}` : v
}

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

  const { codigoFamiliar, cpf, rendaPerCapita, showDia } = (body ?? {}) as {
    codigoFamiliar?: string
    cpf?: string
    rendaPerCapita?: number | string
    showDia?: string
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

  // 🆕 Validação do show
  const showValido = typeof showDia === 'string' ? showDia.trim() : ''
  if (!showValido || !SHOW_VALUES.has(showValido)) {
    return NextResponse.json(
      { error: 'Selecione um show válido' },
      { status: 400 },
    )
  }

  // 3️⃣.5 🚫 TRAVA DE RENDA
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

  // 5️⃣ Gate de registro por evento
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

  // 6️⃣ Persiste com limite ATÔMICO por show
  //    Sentinela usada para diferenciar "estourou limite" de outros erros.
  const LIMITE_ESTOURADO = 'LIMITE_ESTOURADO'

  try {
    const criado = await prisma.$transaction(async (tx) => {
      // cria o registro (duplicata de código → P2002 → rollback)
      const reg = await tx.folhaResumoIngresso.create({
        data: {
          eventoId,
          codigoFamiliar: codigo,
          cpf: cpfLimpo,
          rendaPerCapita: new Prisma.Decimal(renda),
          registradoPor,
          showDia: showValido, // 🆕
        },
        select: { id: true, codigoFamiliar: true, createdAt: true },
      })

      // controle de limite: só se houver linha de limite configurada com limite > 0
      const limiteRow = await tx.limiteShow.findUnique({
        where: { eventoId_showDia: { eventoId, showDia: showValido } },
        select: { limite: true },
      })

      if (limiteRow && limiteRow.limite > 0) {
        // increment atômico + leitura do novo valor
        const atualizado = await tx.limiteShow.update({
          where: { eventoId_showDia: { eventoId, showDia: showValido } },
          data: { usados: { increment: 1 } },
          select: { usados: true, limite: true },
        })

        if (atualizado.usados > atualizado.limite) {
          // estourou → aborta tudo (registro + incremento revertem)
          throw new Error(LIMITE_ESTOURADO)
        }
      }

      return reg
    })

    return NextResponse.json({ ok: true, ingresso: criado }, { status: 201 })
  } catch (err) {
    // limite estourado
    if (err instanceof Error && err.message === LIMITE_ESTOURADO) {
      const label = labelShow(showValido)
      return NextResponse.json(
        {
          error: `Limite de ingressos para ${label} esgotado. Não há mais vagas disponíveis para este show.`,
        },
        { status: 409 },
      )
    }
    // código familiar duplicado
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
 * GET → lista últimos 20 ingressos + line-up fixo + status de limites.
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
    take: LIMITE_LISTA,
    select: {
      id: true,
      codigoFamiliar: true,
      cpf: true,
      rendaPerCapita: true,
      showDia: true,
      createdAt: true,
    },
  })

  const lista = registros.map((r) => ({
    id: r.id,
    codigoFamiliar: mascararCodigo(r.codigoFamiliar),
    cpf: mascararCpf(r.cpf),
    rendaPerCapita: Number(r.rendaPerCapita),
    show: labelShow(r.showDia),
    createdAt: r.createdAt,
  }))

  // 🆕 status de limites por show (só shows com limite configurado aparecem com números)
  const limites = await prisma.limiteShow.findMany({
    where: { eventoId },
    select: { showDia: true, limite: true, usados: true },
  })
  const limitesMap = new Map(limites.map((l) => [l.showDia, l]))

  const shows = SHOWS.map((s) => {
    const lim = limitesMap.get(s.value)
    return {
      value: s.value,
      artista: s.artista,
      data: s.data,
      limite: lim?.limite ?? 0, // 0 = sem limite
      usados: lim?.usados ?? 0,
      esgotado: lim ? lim.limite > 0 && lim.usados >= lim.limite : false,
    }
  })

  return NextResponse.json({ total: lista.length, registros: lista, shows })
}

/**
 * DELETE → remove um ingresso da folha resumo. SÓ dev.
 * Também decrementa o contador de limite do show (se houver).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result
  const role = result.user.role

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
    await prisma.$transaction(async (tx) => {
      // busca o registro pra saber o show antes de apagar
      const reg = await tx.folhaResumoIngresso.findFirst({
        where: { id: registroId, eventoId },
        select: { id: true, showDia: true },
      })
      if (!reg) throw new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'x',
      })

      await tx.folhaResumoIngresso.delete({ where: { id: reg.id } })

      // devolve a vaga (decrementa, sem deixar negativo)
      if (reg.showDia) {
        const lim = await tx.limiteShow.findUnique({
          where: { eventoId_showDia: { eventoId, showDia: reg.showDia } },
          select: { usados: true },
        })
        if (lim && lim.usados > 0) {
          await tx.limiteShow.update({
            where: { eventoId_showDia: { eventoId, showDia: reg.showDia } },
            data: { usados: { decrement: 1 } },
          })
        }
      }
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
