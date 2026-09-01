import { Prisma } from '@prisma/client'

export const PAA_UNIDADES = ['Kg', 'Dúzia', 'Litro', 'Maço', 'Unidade'] as const

export type PaaData = {
  isPaa: boolean
  codigoConab: number | null
  codigoConabOrganico: number | null
  temOrganico: boolean
  paaConvencional: Prisma.Decimal | null
  paaOrganico: Prisma.Decimal | null
  paaUnidade: string | null
  paaFatorKg: Prisma.Decimal
}

const toInt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : NaN
}

const toDec = (v: unknown): Prisma.Decimal | null => {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).replace(',', '.')
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0) return null
  return new Prisma.Decimal(s)
}

/**
 * Normaliza + valida o bloco PAA.
 * isPaa=false ⇒ limpa TUDO (evita códigos órfãos travando o @unique).
 */
export function buildPaaData(body: any): { data: PaaData } | { error: string } {
  if (!body.isPaa) {
    return {
      data: {
        isPaa: false,
        codigoConab: null,
        codigoConabOrganico: null,
        temOrganico: false,
        paaConvencional: null,
        paaOrganico: null,
        paaUnidade: null,
        paaFatorKg: new Prisma.Decimal(1),
      },
    }
  }

  const codigoConab = toInt(body.codigoConab)
  if (codigoConab === null) return { error: 'Código CONAB é obrigatório para produtos do PAA.' }
  if (Number.isNaN(codigoConab)) return { error: 'Código CONAB deve ser um número inteiro positivo.' }

  const paaUnidade = String(body.paaUnidade ?? '').trim()
  if (!paaUnidade) return { error: 'Unidade PAA é obrigatória.' }

  const temOrganico = Boolean(body.temOrganico)
  const paaConvencional = toDec(body.paaConvencional)
  const paaOrganico = temOrganico ? toDec(body.paaOrganico) : null

  if (!paaConvencional && !paaOrganico) {
    return { error: 'Informe ao menos um preço PAA (convencional ou orgânico).' }
  }
  if (temOrganico && !paaOrganico) {
    return { error: 'Marcado "tem versão orgânica": informe o preço orgânico.' }
  }

  let codigoConabOrganico: number | null = null
  if (temOrganico) {
    codigoConabOrganico = toInt(body.codigoConabOrganico)
    if (Number.isNaN(codigoConabOrganico)) {
      return { error: 'Código CONAB orgânico deve ser um número inteiro positivo.' }
    }
    if (codigoConabOrganico === codigoConab) {
      return { error: 'Código CONAB orgânico não pode ser igual ao convencional.' }
    }
  }

  const fator = toDec(body.paaFatorKg ?? '1')
  if (!fator || fator.lte(0)) return { error: 'Fator de conversão para kg deve ser maior que zero.' }

  return {
    data: {
      isPaa: true,
      codigoConab,
      codigoConabOrganico,
      temOrganico,
      paaConvencional,
      paaOrganico,
      paaUnidade,
      paaFatorKg: fator,
    },
  }
}

/** Checa colisão cruzada nos dois campos @unique. */
export async function checkCodigoColisao(
  prisma: any,
  data: PaaData,
  ignoreId?: string
): Promise<string | null> {
  if (!data.isPaa) return null

  const codigos = [data.codigoConab, data.codigoConabOrganico].filter(
    (c): c is number => c !== null
  )
  if (codigos.length === 0) return null

  const conflitos = await prisma.product.findMany({
    where: {
      id: ignoreId ? { not: ignoreId } : undefined,
      OR: [{ codigoConab: { in: codigos } }, { codigoConabOrganico: { in: codigos } }],
    },
    select: { name: true, codigoConab: true, codigoConabOrganico: true },
  })

  if (conflitos.length === 0) return null
  const c = conflitos[0]
  const codigo = codigos.find((k) => k === c.codigoConab || k === c.codigoConabOrganico)
  return `Código CONAB ${codigo} já está em uso pelo produto "${c.name}".`
}
