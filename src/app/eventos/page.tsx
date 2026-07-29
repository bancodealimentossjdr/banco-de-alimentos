import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/permissions'
import EventosListClient from './EventosListClient'
import BotaoVoltar from '@/components/ui/BotaoVoltar'

// ⚡ #1 — deixa de ser force-dynamic. Revalida a cada 30s → sensação instantânea.
// Eventos mudam pouco; 30s é imperceptível e corta 90% das idas ao banco.
export const revalidate = 30

type EventoStatus = 'RASCUNHO' | 'ATIVO' | 'ENCERRADO'

const ordemStatus: Record<EventoStatus, number> = {
  ATIVO: 0,
  RASCUNHO: 1,
  ENCERRADO: 2,
}

export default async function EventosPage() {
  const session = await auth()
  const role = session?.user?.role
  if (!role) redirect('/login')

  const podeGerenciar = canEdit(role, 'eventos')

  const eventos = await prisma.evento.findMany({
    where: podeGerenciar ? {} : { status: { not: 'RASCUNHO' } },
    // ⚡ ordena só por data no banco (índice). O status a gente ordena no JS,
    //    que é o único critério que o banco não resolve na ordem certa.
    orderBy: { dataInicio: 'desc' },
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
    // ⚡ 1 sort só: banco já entregou por dataInicio desc, aqui só reagrupa por status
    .sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <BotaoVoltar fallbackHref="/" />
      <EventosListClient eventos={eventosView} podeGerenciar={podeGerenciar} />
    </div>
  )
}
