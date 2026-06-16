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

  // Ordem semântica: Ativos → Rascunhos → Encerrados (mais recentes primeiro dentro de cada grupo)
  const ordemStatus: Record<EventoStatus, number> = {
    ATIVO: 0,
    RASCUNHO: 1,
    ENCERRADO: 2,
  }

  // Serializa datas e normaliza para o Client Component
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
      // dentro do mesmo status: data de início mais recente primeiro
      return b.dataInicio.localeCompare(a.dataInicio)
    })

  return <EventosListClient eventos={eventosView} podeGerenciar={podeGerenciar} />
}
