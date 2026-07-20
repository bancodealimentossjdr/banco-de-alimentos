import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, category: true, unit: true },
  })
  console.log(`\n📦 ${products.length} produtos ativos no catálogo:\n`)
  for (const p of products) {
    console.log(`   ${p.name.padEnd(28)} | ${p.unit.padEnd(4)} | ${p.category}`)
  }
  console.log()
}
main().catch(console.error).finally(() => prisma.$disconnect())
