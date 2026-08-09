import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * 🛡️ Backend nunca confia no frontend.
 * Bloqueia NOVOS lançamentos vinculados a cadastros inativos.
 * ⚠️ Usar SOMENTE no POST — o PUT precisa tolerar registros históricos.
 * Retorna NextResponse (erro) ou null (ok).
 */
export async function validarCadastrosAtivos(params: {
  donorId?: string | null
  beneficiaryId?: string | null
  producerId?: string | null
  employeeIds?: (string | null | undefined)[]
  productIds?: string[]
}): Promise<NextResponse | null> {
  const { donorId, beneficiaryId, producerId, employeeIds = [], productIds = [] } = params

  if (donorId) {
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      select: { name: true, active: true },
    })
    if (!donor) return NextResponse.json({ error: 'Doador não encontrado' }, { status: 404 })
    if (!donor.active) {
      return NextResponse.json(
        { error: `O doador "${donor.name}" está inativo e não pode receber novos lançamentos.` },
        { status: 400 },
      )
    }
  }

  if (beneficiaryId) {
    const b = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      select: { name: true, status: true },
    })
    if (!b) return NextResponse.json({ error: 'Instituição não encontrada' }, { status: 404 })
    if (b.status !== 'ativo') {
      return NextResponse.json(
        { error: `A instituição "${b.name}" está inativa e não pode receber novas distribuições.` },
        { status: 400 },
      )
    }
  }

  if (producerId) {
    const p = await prisma.producer.findUnique({
      where: { id: producerId },
      select: { name: true, active: true },
    })
    if (!p) return NextResponse.json({ error: 'Produtor não encontrado' }, { status: 404 })
    if (!p.active) {
      return NextResponse.json(
        { error: `O produtor "${p.name}" está inativo e não pode receber novas colheitas.` },
        { status: 400 },
      )
    }
  }

  const empIds = employeeIds.filter(Boolean) as string[]
  if (empIds.length > 0) {
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, name: true, active: true },
    })
    if (emps.length !== new Set(empIds).size) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }
    const inativo = emps.find(e => !e.active)
    if (inativo) {
      return NextResponse.json(
        { error: `O funcionário "${inativo.name}" está inativo e não pode ser vinculado.` },
        { status: 400 },
      )
    }
  }

  const prodIds = Array.from(new Set(productIds.filter(Boolean)))
  if (prodIds.length > 0) {
    const prods = await prisma.product.findMany({
      where: { id: { in: prodIds } },
      select: { id: true, name: true, active: true },
    })
    if (prods.length !== prodIds.length) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
    }
    const inativo = prods.find(p => !p.active)
    if (inativo) {
      return NextResponse.json(
        { error: `O produto "${inativo.name}" está inativo e não pode ser lançado.` },
        { status: 400 },
      )
    }
  }

  return null
}
