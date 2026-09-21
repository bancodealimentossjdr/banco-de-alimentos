import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEdit } from '@/lib/auth-helpers'
import { buildPaaData, checkCodigoColisao } from '@/lib/paa'
import { canManageTabelaConab } from '@/lib/permissions'
import { conabFieldsChanged, conabDeniedMessage } from '@/lib/paa-conab-gate'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const body = await request.json()

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    if (!body.name?.trim() || !body.category || !body.unit) {
      return NextResponse.json({ error: 'Nome, categoria e unidade são obrigatórios.' }, { status: 400 })
    }

    const paa = buildPaaData(body)
    if ('error' in paa) return NextResponse.json({ error: paa.error }, { status: 400 })

    // 🔒 ONDA 23.8 — débito #5: só o dev muda a tabela CONAB.
    // Diff contra o banco: reenviar o mesmo valor não é alteração, então
    // admin segue editando nome/categoria/unidade de um produto PAA.
    const conabAlterado = conabFieldsChanged(paa.data as Record<string, unknown>, product)
    if (conabAlterado.length > 0 && !canManageTabelaConab(authResult.user.role)) {
      return NextResponse.json({ error: conabDeniedMessage(conabAlterado) }, { status: 403 })
    }

    // Bloqueia despromoção de produto com entregas PAA registradas
    if (product.isPaa && !paa.data.isPaa) {
      const usos = await prisma.entregaPaaItem.count({ where: { productId: id } })
      if (usos > 0) {
        return NextResponse.json(
          { error: `Não é possível remover do PAA: existem ${usos} item(ns) em entregas PAA vinculados.` },
          { status: 400 }
        )
      }
    }

    const colisao = await checkCodigoColisao(prisma, paa.data, id)
    if (colisao) return NextResponse.json({ error: colisao }, { status: 409 })

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: body.name.trim(),
        category: body.category,
        unit: body.unit,
        // ⚠️ não zera minStock quando o form não envia o campo
        minStock: body.minStock === undefined ? product.minStock : Number(body.minStock) || 0,
        ...paa.data,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT produto:', error)
    return NextResponse.json({ error: 'Erro ao atualizar produto' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('produtos')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            donationItems: true,
            distributionItems: true,
            harvestItems: true,
            entregaPaaItens: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }

    const c = product._count
    const total = c.donationItems + c.distributionItems + c.harvestItems + c.entregaPaaItens
    if (total > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: ${c.donationItems} doação(ões), ${c.distributionItems} distribuição(ões), ${c.harvestItems} colheita(s) e ${c.entregaPaaItens} entrega(s) PAA vinculada(s).`,
        },
        { status: 400 }
      )
    }

    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ message: 'Produto excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE produto:', error)
    return NextResponse.json({ error: 'Erro ao excluir produto' }, { status: 500 })
  }
}
