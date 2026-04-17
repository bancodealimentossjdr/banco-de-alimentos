import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'admin' }
  })

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@bancodealimentos.org',
        password: hashedPassword,
        role: 'admin',
        active: true,
      }
    })
    
    console.log('✅ Usuário admin criado com sucesso!')
    console.log('📧 Email: admin@bancodealimentos.org')
    console.log('🔑 Senha: admin123')
  } else {
    console.log('ℹ️  Admin já existe, seed ignorado.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
