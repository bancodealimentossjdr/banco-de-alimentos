import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// ==========================================
// TIPOS DE FILTRO
// ==========================================
export type IndicadoresFilters = {
  dataInicio?: Date
  dataFim?: Date
  doadorIds?: string[]
  produtorIds?: string[]
  beneficiarioIds?: string[]
  funcionarioIds?: string[]
}

// ==========================================
// HELPERS DE WHERE (filtros AND/OR)
// ==========================================

/**
 * Constrói WHERE de funcionários: OR entre os 3 campos.
 * Se múltiplos funcionários, usa `in` em cada campo.
 */
function whereFuncionariosOR(funcionarioIds?: string[]) {
  if (!funcionarioIds || funcionarioIds.length === 0) return null
  return {
    OR: [
      { employeeId: { in: funcionarioIds } },
      { employee2Id: { in: funcionarioIds } },
      { employee3Id: { in: funcionarioIds } },
    ],
  }
}

function whereDataRange(dataInicio?: Date, dataFim?: Date) {
  if (!dataInicio && !dataFim) return null
  const range: { gte?: Date; lte?: Date } = {}
  if (dataInicio) range.gte = dataInicio
  if (dataFim) range.lte = dataFim
  return { date: range }
}

/**
 * Monta WHERE de Doação combinando filtros (AND entre categorias).
 */
function buildDonationWhere(filters: IndicadoresFilters): Prisma.DonationWhereInput {
  const ands: Prisma.DonationWhereInput[] = []

  const dateW = whereDataRange(filters.dataInicio, filters.dataFim)
  if (dateW) ands.push(dateW)

  if (filters.doadorIds?.length) {
    ands.push({ donorId: { in: filters.doadorIds } })
  }

  const funcW = whereFuncionariosOR(filters.funcionarioIds)
  if (funcW) ands.push(funcW)

  return ands.length ? { AND: ands } : {}
}

/**
 * Monta WHERE de Distribuição.
 */
function buildDistributionWhere(filters: IndicadoresFilters): Prisma.DistributionWhereInput {
  const ands: Prisma.DistributionWhereInput[] = []

  const dateW = whereDataRange(filters.dataInicio, filters.dataFim)
  if (dateW) ands.push(dateW)

  if (filters.beneficiarioIds?.length) {
    ands.push({ beneficiaryId: { in: filters.beneficiarioIds } })
  }

  const funcW = whereFuncionariosOR(filters.funcionarioIds)
  if (funcW) ands.push(funcW)

  return ands.length ? { AND: ands } : {}
}

/**
 * Monta WHERE de Colheita (sempre filtra status="realizada").
 */
function buildHarvestWhere(filters: IndicadoresFilters): Prisma.SolidarityHarvestWhereInput {
  const ands: Prisma.SolidarityHarvestWhereInput[] = [
    { status: 'realizada' }, // 🔒 sempre só realizadas
  ]

  const dateW = whereDataRange(filters.dataInicio, filters.dataFim)
  if (dateW) ands.push(dateW)

  if (filters.produtorIds?.length) {
    ands.push({ producerId: { in: filters.produtorIds } })
  }

  const funcW = whereFuncionariosOR(filters.funcionarioIds)
  if (funcW) ands.push(funcW)

  return { AND: ands }
}

// ==========================================
// PARTICIPAÇÃO DE FUNCIONÁRIOS
// ==========================================

export type FuncionarioParticipacao = {
  funcionarioId: string
  funcionarioNome: string
  funcionarioRole: string | null
  kgEnvolvido: number
  numEventos: number
  numDoacoes: number
  numDistribuicoes: number
  numColheitas: number
}

/**
 * Calcula participação de TODOS os funcionários ativos,
 * considerando os filtros aplicados (data, doador, produtor, beneficiário).
 *
 * 🔑 Conceito-chave: "kg envolvido" = soma dos kg de TODOS os eventos
 * em que o funcionário aparece em QUALQUER um dos 3 campos.
 * Mesmo kg pode contar pra mais de um funcionário (decisão de domínio).
 */
export async function getParticipacaoFuncionarios(
  filters: IndicadoresFilters = {}
): Promise<FuncionarioParticipacao[]> {
  // 1) Busca funcionários ativos
  const funcionarios = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })

  if (funcionarios.length === 0) return []

  // 2) Pra cada funcionário, calcula participação
  //    (estratégia: 1 query por funcionário, paralelizada)
  const resultados = await Promise.all(
    funcionarios.map(async (func) => {
      // Filtro base + força esse funcionário em pelo menos 1 dos 3 campos
      const funcFilter = { funcionarioIds: [func.id] }

      const donationWhere = buildDonationWhere({ ...filters, ...funcFilter })
      const distributionWhere = buildDistributionWhere({ ...filters, ...funcFilter })
      const harvestWhere = buildHarvestWhere({ ...filters, ...funcFilter })

      const [doacoes, distribuicoes, colheitas] = await Promise.all([
        prisma.donation.findMany({
          where: donationWhere,
          select: { items: { select: { quantity: true } } },
        }),
        prisma.distribution.findMany({
          where: distributionWhere,
          select: { items: { select: { quantity: true } } },
        }),
        prisma.solidarityHarvest.findMany({
          where: harvestWhere,
          select: { items: { select: { quantity: true } } },
        }),
      ])

      const sumKg = (arr: { items: { quantity: number }[] }[]) =>
        arr.reduce(
          (acc, ev) => acc + ev.items.reduce((s, i) => s + i.quantity, 0),
          0
        )

      const kgDoacoes = sumKg(doacoes)
      const kgDistribuicoes = sumKg(distribuicoes)
      const kgColheitas = sumKg(colheitas)

      return {
        funcionarioId: func.id,
        funcionarioNome: func.name ?? 'Sem nome', // ✅ garante string pura (Prisma name pode ser null)
        funcionarioRole: func.role,
        kgEnvolvido: kgDoacoes + kgDistribuicoes + kgColheitas,
        numEventos: doacoes.length + distribuicoes.length + colheitas.length,
        numDoacoes: doacoes.length,
        numDistribuicoes: distribuicoes.length,
        numColheitas: colheitas.length,
      }
    })
  )

  // 3) Ordena por kgEnvolvido desc (Top 5 pega os primeiros)
  return resultados.sort((a, b) => b.kgEnvolvido - a.kgEnvolvido)
}

// ==========================================
// LISTAS PRA POPULAR FILTROS (multiselects)
// ==========================================

export async function getFiltroOpcoes() {
  const [doadores, produtores, beneficiarios, funcionarios] = await Promise.all([
    prisma.donor.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.producer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.beneficiary.findMany({
      where: { status: 'ativo' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return { doadores, produtores, beneficiarios, funcionarios }
}
