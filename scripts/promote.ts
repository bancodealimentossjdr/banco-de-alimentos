import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error('Uso: npx tsx scripts/promote.ts seu@email.com')

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'dev' },
    select: { id: true, name: true, email: true, role: true },
  })

  console.log('✅ Atualizado:', user)
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
