import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import EventosListClient from './EventosListClient'

export const dynamic = 'force-dynamic'

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

export default async function EventosPage() {
  const session = await auth()
  const role = session?.user?.role
  if (!role) redirect('/login')

  const podeGerenciar = canEdit(role, 'eventos')

  const eventos = await prisma.evento.findMany({
    // 🔐 Visualizador NÃO vê rascunhos (coisa interna). Defesa no servidor.
    where: podeGerenciar ? {} : { status: { not: 'RASCUNHO' } },
    orderBy: [{ status: 'asc' }, { dataInicio: 'desc' }],
    select: {
      id: true,
      nome: true,
      descricao: true,
      dataInicio: true,
      dataFim: true,
      status: true,
      integraEstoque: true,
      _count: {
        select: { recebimentos: true, locais: true, alimentos: true },
      },
    },
  })

  const ordemStatus: Record<EventoStatus, number> = {
    ATIVO: 0,
    RASCUNHO: 1,
    ENCERRADO: 2,
  }

  const eventosView = eventos
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      descricao: e.descricao,
      dataInicio: e.dataInicio.toISOString(),
      dataFim: e.dataFim ? e.dataFim.toISOString() : null,
      status: e.status as EventoStatus,
      integraEstoque: e.integraEstoque,
      counts: {
        recebimentos: e._count.recebimentos,
        locais: e._count.locais,
        alimentos: e._count.alimentos,
      },
    }))
    .sort((a, b) => {
      const porStatus = ordemStatus[a.status] - ordemStatus[b.status]
      if (porStatus !== 0) return porStatus
      return b.dataInicio.localeCompare(a.dataInicio)
    })

  return <EventosListClient eventos={eventosView} podeGerenciar={podeGerenciar} />
}
