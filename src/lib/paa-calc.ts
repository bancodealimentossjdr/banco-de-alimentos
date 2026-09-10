import { Prisma } from '@prisma/client'

export type TipoCultivo = 'CONVENCIONAL' | 'ORGANICO'

export type ItemInput = {
  productId: string
  tipoCultivo?: string
  quantidade: unknown
}

export type ItemCalculado = {
  productId: string
  tipoCultivo: TipoCultivo
  quantidade: Prisma.Decimal
  precoUnitario: Prisma.Decimal
  fatorKg: Prisma.Decimal
  pesoKg: Prisma.Decimal
  subtotal: Prisma.Decimal
}

export type ResultadoCalculo = {
  itens: ItemCalculado[]
  valorTotal: Prisma.Decimal
  pesoTotalKg: Prisma.Decimal
}

type ProdutoPaa = {
  id: string
  name: string
  active: boolean
  isPaa: boolean
  temOrganico: boolean
  paaConvencional: Prisma.Decimal | null
  paaOrganico: Prisma.Decimal | null
  paaFatorKg: Prisma.Decimal
}

const toDec = (v: unknown): Prisma.Decimal | null => {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).replace(',', '.')
  if (!Number.isFinite(Number(s))) return null
  try {
    return new Prisma.Decimal(s)
  } catch {
    return null
  }
}

/**
 * 🔒 NÚCLEO DE CONFIANÇA DA ONDA 23.
 *
 * Recalcula TUDO a partir do banco. Nenhum preço, fator, peso ou subtotal
 * vindo do cliente é aproveitado — apenas productId, tipoCultivo e quantidade.
 *
 * O preço e o fator são CONGELADOS no item (decisão 23.1): a tabela CONAB
 * muda por safra e o histórico não pode se reescrever sozinho.
 *
 * @param exigirAtivo true em criação (POST). Em edição (PUT) permitimos
 *                    produto inativado, senão uma entrega antiga fica impossível
 *                    de corrigir depois que o produto sai do catálogo.
 */
export async function calcularItensPaa(
  prisma: any,
  itensRaw: unknown,
  opts: { exigirAtivo: boolean }
): Promise<ResultadoCalculo | { error: string }> {
  if (!Array.isArray(itensRaw) || itensRaw.length === 0) {
    return { error: 'Adicione pelo menos um item à entrega.' }
  }

  const itens = itensRaw as ItemInput[]

  // Normaliza e valida o payload ANTES de bater no banco
  const normalizados: { productId: string; tipoCultivo: TipoCultivo; quantidade: Prisma.Decimal }[] = []

  for (const [i, item] of itens.entries()) {
    const linha = `Item ${i + 1}`

    if (!item?.productId || typeof item.productId !== 'string') {
      return { error: `${linha}: selecione um produto.` }
    }

    const tipo = String(item.tipoCultivo ?? 'CONVENCIONAL').toUpperCase()
    if (tipo !== 'CONVENCIONAL' && tipo !== 'ORGANICO') {
      return { error: `${linha}: tipo de cultivo inválido.` }
    }

    const qtd = toDec(item.quantidade)
    if (!qtd || qtd.lte(0)) {
      return { error: `${linha}: quantidade deve ser maior que zero.` }
    }

    normalizados.push({
      productId: item.productId,
      tipoCultivo: tipo as TipoCultivo,
      quantidade: qtd,
    })
  }

  // 🚫 Um produto não pode aparecer duas vezes com o MESMO tipo de cultivo.
  //    Convencional + Orgânico do mesmo produto é legítimo (preços distintos).
  const chaves = normalizados.map((n) => `${n.productId}::${n.tipoCultivo}`)
  if (new Set(chaves).size !== chaves.length) {
    return {
      error: 'Produto repetido com o mesmo tipo de cultivo. Some as quantidades em uma única linha.',
    }
  }

  const ids = Array.from(new Set(normalizados.map((n) => n.productId)))
  const produtos: ProdutoPaa[] = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      active: true,
      isPaa: true,
      temOrganico: true,
      paaConvencional: true,
      paaOrganico: true,
      paaFatorKg: true,
    },
  })

  const mapa = new Map(produtos.map((p) => [p.id, p]))

  const calculados: ItemCalculado[] = []
  let valorTotal = new Prisma.Decimal(0)
  let pesoTotalKg = new Prisma.Decimal(0)

  for (const n of normalizados) {
    const p = mapa.get(n.productId)
    if (!p) return { error: 'Produto não encontrado no cadastro.' }
    if (!p.isPaa) return { error: `"${p.name}" não está marcado como produto do PAA.` }
    if (opts.exigirAtivo && !p.active) {
      return { error: `"${p.name}" está inativo e não pode receber novos lançamentos.` }
    }

    if (n.tipoCultivo === 'ORGANICO' && !p.temOrganico) {
      return { error: `"${p.name}" não possui versão orgânica cadastrada.` }
    }

    const preco = n.tipoCultivo === 'ORGANICO' ? p.paaOrganico : p.paaConvencional
    if (!preco) {
      const rotulo = n.tipoCultivo === 'ORGANICO' ? 'orgânico' : 'convencional'
      return { error: `"${p.name}" não tem preço PAA ${rotulo} cadastrado.` }
    }

    const fatorKg = p.paaFatorKg ?? new Prisma.Decimal(1)

    // Arredondamento explícito, na mesma precisão das colunas do banco.
    const pesoKg = n.quantidade.mul(fatorKg).toDecimalPlaces(3)
    const subtotal = n.quantidade.mul(preco).toDecimalPlaces(2)

    calculados.push({
      productId: p.id,
      tipoCultivo: n.tipoCultivo,
      quantidade: n.quantidade.toDecimalPlaces(3),
      precoUnitario: new Prisma.Decimal(preco).toDecimalPlaces(2),
      fatorKg: new Prisma.Decimal(fatorKg).toDecimalPlaces(3),
      pesoKg,
      subtotal,
    })

    valorTotal = valorTotal.add(subtotal)
    pesoTotalKg = pesoTotalKg.add(pesoKg)
  }

  return {
    itens: calculados,
    valorTotal: valorTotal.toDecimalPlaces(2),
    pesoTotalKg: pesoTotalKg.toDecimalPlaces(3),
  }
}

/** Converte Decimal → number na saída da API (Decimal serializa como string). */
export function serializeEntregaPaa(e: any) {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  return {
    ...e,
    valorTotal: num(e.valorTotal),
    pesoTotalKg: num(e.pesoTotalKg),
    itens: Array.isArray(e.itens)
      ? e.itens.map((i: any) => ({
          ...i,
          quantidade: num(i.quantidade),
          precoUnitario: num(i.precoUnitario),
          fatorKg: num(i.fatorKg),
          pesoKg: num(i.pesoKg),
          subtotal: num(i.subtotal),
        }))
      : e.itens,
  }
}
