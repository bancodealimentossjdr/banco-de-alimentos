import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EVENTO_ID = 'cmrbncyk30001lcocxk7py4rb'
const DRY_RUN = false // 🔴🔴🔴 TROQUE PARA false PARA APLICAR DE VERDADE

const DATA_INICIO = new Date('2026-07-21T00:00:00-03:00')
const DATA_FIM = new Date('2026-08-07T23:59:59-03:00')

// name = nome EXATO no catálogo. Se não existir, cria com category/unit.
const ALIMENTOS: { name: string; category: string; unit: string }[] = [
  { name: 'Feijão', category: 'graos', unit: 'kg' },
  { name: 'Óleo', category: 'outros', unit: 'L' },
  { name: 'Açúcar', category: 'graos', unit: 'kg' },
  { name: 'Macarrão', category: 'outros', unit: 'kg' }, // ⚠️ duplicado no catálogo — ver nota abaixo
  { name: 'Leite', category: 'laticinios', unit: 'L' },
  { name: 'Café', category: 'outros', unit: 'kg' },           // será criado
  { name: 'Arroz', category: 'graos', unit: 'kg' },
  { name: 'Fralda Descartável', category: 'outros', unit: 'un' }, // será criado
  { name: 'Ração para Cães/Gatos', category: 'outros', unit: 'kg' }, // será criado
]

const LOCAIS: { nome: string; endereco: string }[] = [
  { nome: 'Espaço do Produtor', endereco: 'Rua Dr. Balbino da Cunha, 30 - Centro' },
  { nome: 'Pátio Fábricas', endereco: 'Av. Leite de Castro, 17 - Fábricas' },
  { nome: 'CRAS Matozinhos', endereco: 'Rua Herculano Veloso, 97 - Matozinhos' },
  { nome: 'CRAS São Geraldo', endereco: 'R. Batista Andrade, 81 - São Geraldo' },
  { nome: 'CRAS Tejuco', endereco: 'R. São João, 37 - São José Operário' },
  { nome: 'Escola Municipal Pio XII', endereco: 'R. das Hortências, s/n - Pio XII' },
  { nome: 'Escola Igor Dinalli', endereco: 'São Francisco, s/n - Colônia do Marçal' },
]

async function main() {
  const evento = await prisma.evento.findUnique({
    where: { id: EVENTO_ID },
    include: { _count: { select: { recebimentos: true, folhasResumoIngresso: true, alimentos: true, locais: true, arrecadacoesExtra: true } } },
  })
  if (!evento) throw new Error('❌ Evento não encontrado!')

  console.log(`\n🎯 ${evento.nome} — status: ${evento.status}`)
  console.log('\n📊 ATUAL:')
  console.log(`   • Recebimentos ......... ${evento._count.recebimentos}`)
  console.log(`   • Folhas resumo ........ ${evento._count.folhasResumoIngresso}`)
  console.log(`   • Alimentos vinculados . ${evento._count.alimentos}  → RESET p/ ${ALIMENTOS.length}`)
  console.log(`   • Locais ............... ${evento._count.locais}  → RESET p/ ${LOCAIS.length}`)
  console.log(`   • Arrecadações ......... ${evento._count.arrecadacoesExtra}  → APAGADAS`)
  console.log(`\n📅 ${DATA_INICIO.toLocaleDateString('pt-BR')} → ${DATA_FIM.toLocaleDateString('pt-BR')} | status → ATIVO\n`)

  if (DRY_RUN) {
    console.log('🟡 DRY_RUN=true — NADA foi alterado. Edite a linha DRY_RUN para false e rode de novo.\n')
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.recebimento.deleteMany({ where: { eventoId: EVENTO_ID } })
    await tx.folhaResumoIngresso.deleteMany({ where: { eventoId: EVENTO_ID } })
    await tx.arrecadacaoExtra.deleteMany({ where: { eventoId: EVENTO_ID } })
    await tx.eventoAlimento.deleteMany({ where: { eventoId: EVENTO_ID } })

    let ordem = 0
    for (const a of ALIMENTOS) {
      // pega o MAIS ANTIGO em caso de nome duplicado (ex: Macarrão), pra ser determinístico
      let product = await tx.product.findFirst({
        where: { name: a.name },
        orderBy: { createdAt: 'asc' },
      })
      if (!product) {
        product = await tx.product.create({ data: { name: a.name, category: a.category, unit: a.unit } })
        console.log(`   ⚠️ Produto criado: ${a.name}`)
      } else {
        console.log(`   ✅ Reusando produto existente: ${a.name} (${product.unit})`)
      }
      await tx.eventoAlimento.create({
        data: { eventoId: EVENTO_ID, productId: product.id, ordem, refugoKg: 0 },
      })
      ordem++
    }

    await tx.localColeta.deleteMany({ where: { eventoId: EVENTO_ID } })
    for (const l of LOCAIS) {
      await tx.localColeta.create({ data: { eventoId: EVENTO_ID, ...l } })
    }

    await tx.evento.update({
      where: { id: EVENTO_ID },
      data: { dataInicio: DATA_INICIO, dataFim: DATA_FIM, status: 'ATIVO' },
    })
  })

  console.log('\n✅ Expo Del Rei resetado e reconfigurado!\n')
}

main().catch((e) => { console.error('❌', e); process.exit(1) }).finally(() => prisma.$disconnect())
