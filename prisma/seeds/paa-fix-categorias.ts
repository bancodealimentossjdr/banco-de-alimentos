import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const MAP: Record<string, string> = {
  Frutas: 'fruta',
  Verduras: 'verdura',
  Legumes: 'hortifruti',
  'Grãos': 'graos',
  Temperos: 'ingredientes',
  Panificados: 'padaria',
  'Laticínios': 'laticinios',
  Outros: 'outros',
}

async function main() {
  for (const [de, para] of Object.entries(MAP)) {
    const r = await prisma.product.updateMany({
      where: { category: de },
      data: { category: para },
    })
    if (r.count) console.log(`  ${de} → ${para}: ${r.count}`)
  }
  console.log('✅ Categorias normalizadas.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
