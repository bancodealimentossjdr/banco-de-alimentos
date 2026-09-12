import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { canSeeHidden } from '@/lib/permissions'
import { filtroLista, lerModoOcultos } from '@/lib/visibilidade'
import { maskBeneficiarioList } from '@/lib/mask-by-role'

export async function GET(request: Request) {
  // 🔐 requireView já resolveu a sessão — não chamar auth() de novo.
  const authResult = await requireView('beneficiarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role
  const podeVerOcultos = canSeeHidden(role)

  try {
    const { searchParams } = new URL(request.url)
    // ⚠️ Beneficiary usa `status: 'ativo'`, não `active: boolean`.
    const apenasAtivos = searchParams.get('apenasAtivos') === '1'
    const incluir = searchParams.get('incluir')
    const modo = lerModoOcultos(searchParams)

    // 👁️ ONDA 23.7e-3 — visibilidade
    const visibilidade = filtroLista(role, modo, apenasAtivos) as Prisma.BeneficiaryWhereInput
    const filtroAtivo: Prisma.BeneficiaryWhereInput = apenasAtivos ? { status: 'ativo' } : {}

    const where: Prisma.BeneficiaryWhereInput = incluir
      ? { OR: [{ AND: [visibilidade, filtroAtivo] }, { id: incluir }] }
      : { AND: [visibilidade, filtroAtivo] }

    const [beneficiaries, contadores] = await Promise.all([
      prisma.beneficiary.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: { distributions: true } } },
      }),
      podeVerOcultos
        ? Promise.all([
            prisma.beneficiary.count({ where: { hiddenAt: null } }),
            prisma.beneficiary.count({ where: { hiddenAt: { not: null } } }),
          ])
        : Promise.resolve(null),
    ])

    const res = NextResponse.json(maskBeneficiarioList(beneficiaries, role))
    if (contadores) {
      res.headers.set('X-Visiveis', String(contadores[0]))
      res.headers.set('X-Ocultos', String(contadores[1]))
    }
    return res
  } catch (error) {
    console.error('Erro GET beneficiários:', error)
    return NextResponse.json({ error: 'Erro ao buscar instituições' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await requireEdit('beneficiarios')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json()

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json(
        { error: 'O nome da instituição é obrigatório' },
        { status: 400 },
      )
    }

    const beneficiary = await prisma.beneficiary.create({
      data: {
        name,
        type: body.type,
        address: body.address || null,
        phone: body.phone || null,
        contact: body.contact || null,
        status: body.status || 'ativo',
        notes: body.notes || null,
      },
    })
    return NextResponse.json(beneficiary, { status: 201 })
  } catch (error) {
    console.error('Erro POST beneficiário:', error)
    return NextResponse.json({ error: 'Erro ao criar instituição' }, { status: 500 })
  }
}
