import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { maskProdutor } from '@/lib/mask-by-role'
import { podeVerRegistro } from '@/lib/visibilidade'

const NAO_ENCONTRADO = () =>
  NextResponse.json({ error: 'Produtor não encontrado' }, { status: 404 })

// GET - Buscar produtor por ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireView('produtores')
  if (authResult instanceof NextResponse) return authResult

  // 🔐 requireView já resolveu a sessão — não chamar auth() de novo.
  const role = authResult.user.role

  try {
    const { id } = await params

    const produtor = await prisma.producer.findUnique({
      where: { id },
      include: {
        harvests: {
          include: { items: { include: { product: true } } },
          orderBy: { date: 'desc' },
        },
        _count: { select: { harvests: true, entregasPaa: true } },
      },
    })

    if (!produtor) return NAO_ENCONTRADO()

    // 👁️ oculto = inexistente para não-dev (404, nunca 403)
    if (!podeVerRegistro(role, produtor)) return NAO_ENCONTRADO()

    const masked = maskProdutor(produtor, role)
    return NextResponse.json(masked)
  } catch (error) {
    console.error('Erro ao buscar produtor:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtor' }, { status: 500 })
  }
}

// PUT - Atualizar produtor (edição completa pelo formulário)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireEdit('produtores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()
    const { name, phone, address, property, active, atendePaa } = body

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const existing = await prisma.producer.findUnique({ where: { id } })
    if (!existing) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, existing)) return NAO_ENCONTRADO()

    // 🌾 Bloqueia remoção da flag PAA se houver entregas vinculadas
    if (existing.atendePaa && atendePaa === false) {
      const usos = await prisma.entregaPaa.count({ where: { producerId: id } })
      if (usos > 0) {
        return NextResponse.json(
          { error: `Não é possível remover do PAA: este produtor possui ${usos} entrega(s) PAA registrada(s).` },
          { status: 400 },
        )
      }
    }

    const produtor = await prisma.producer.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: phone || null,
        address: address || null,
        property: property || null,
        // ⚠️ preserva o valor atual quando o campo não vem no payload
        active: active === undefined ? existing.active : Boolean(active),
        atendePaa: atendePaa === undefined ? existing.atendePaa : Boolean(atendePaa),
      },
      include: {
        _count: { select: { harvests: true, entregasPaa: true } },
      },
    })

    return NextResponse.json(produtor)
  } catch (error) {
    console.error('Erro ao atualizar produtor:', error)
    return NextResponse.json({ error: 'Erro ao atualizar produtor' }, { status: 500 })
  }
}

// PATCH - Atualização parcial (toggle de ativo / flag PAA / cota override)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireEdit('produtores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.producer.findUnique({ where: { id } })
    if (!existing) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, existing)) return NAO_ENCONTRADO()

    const data: Record<string, unknown> = {}
    if (body.active !== undefined) data.active = Boolean(body.active)

    if (body.atendePaa !== undefined) {
      const novo = Boolean(body.atendePaa)
      if (existing.atendePaa && !novo) {
        const usos = await prisma.entregaPaa.count({ where: { producerId: id } })
        if (usos > 0) {
          return NextResponse.json(
            { error: `Não é possível remover do PAA: este produtor possui ${usos} entrega(s) PAA registrada(s).` },
            { status: 400 },
          )
        }
      }
      data.atendePaa = novo
    }

    // 🔒 Cota individual — EXCLUSIVO do dev (role vem da sessão, nunca do body)
    if (body.cotaOverride !== undefined || body.cotaOverrideNota !== undefined) {
      if (role !== 'dev') {
        return NextResponse.json(
          { error: 'Apenas o desenvolvedor pode definir cota individual.' },
          { status: 403 },
        )
      }

      if (body.cotaOverride === null || body.cotaOverride === '') {
        // ↩️ Volta para a cota padrão global
        data.cotaOverride = null
        data.cotaOverrideNota = null
      } else {
        const v = Number(body.cotaOverride)
        if (!Number.isFinite(v) || v <= 0) {
          return NextResponse.json(
            { error: 'cotaOverride deve ser um número positivo.' },
            { status: 400 },
          )
        }
        const nota = String(body.cotaOverrideNota ?? '').trim()
        if (nota.length < 5) {
          return NextResponse.json(
            { error: 'Justifique a cota individual com pelo menos 5 caracteres.' },
            { status: 400 },
          )
        }
        data.cotaOverride = v
        data.cotaOverrideNota = nota
      }
    }

    // 🚫 hiddenAt NÃO se altera aqui — só via PATCH /[id]/visibilidade
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
    }

    const produtor = await prisma.producer.update({
      where: { id },
      data,
      include: {
        _count: { select: { harvests: true, entregasPaa: true } },
      },
    })

    return NextResponse.json(produtor)
  } catch (error) {
    console.error('Erro ao atualizar produtor (PATCH):', error)
    return NextResponse.json({ error: 'Erro ao atualizar produtor' }, { status: 500 })
  }
}

// DELETE - Excluir produtor
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireEdit('produtores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const produtor = await prisma.producer.findUnique({
      where: { id },
      include: { _count: { select: { harvests: true, entregasPaa: true } } },
    })

    if (!produtor) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, produtor)) return NAO_ENCONTRADO()

    const { harvests, entregasPaa } = produtor._count
    if (harvests + entregasPaa > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir. Este produtor possui ${harvests} colheita(s) e ${entregasPaa} entrega(s) PAA vinculada(s).` },
        { status: 400 },
      )
    }

    await prisma.producer.delete({ where: { id } })
    return NextResponse.json({ message: 'Produtor excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir produtor:', error)
    return NextResponse.json({ error: 'Erro ao excluir produtor' }, { status: 500 })
  }
}
