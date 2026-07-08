import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import BotaoVoltar from '@/components/ui/BotaoVoltar'
import NovoEventoForm from './NovoEventoForm'

export const dynamic = 'force-dynamic'

export default async function NovoEventoPage() {
  const session = await auth()
  const role = session?.user?.role
  if (!role) redirect('/login')

  // 🔐 Defesa em profundidade: só admin cria (mesmo que a API já bloqueie)
  if (!canEdit(role, 'eventos')) redirect('/eventos')

  const produtos = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, unit: true },
  })

  return (
    <div className="p-4 md:p-6 space-y-4">
      <BotaoVoltar fallbackHref="/eventos" />
      <NovoEventoForm produtos={produtos} />
    </div>
  )
}
