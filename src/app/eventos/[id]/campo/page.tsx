import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireRegisterRecebimento } from '@/lib/auth-helpers'
import CampoCliente from './CampoCliente'

/**
 * 🆕 ONDA 17.4-c — Tela de campo (B-turbo).
 *
 * Server Component: valida permissão, busca evento + locais + alimentos
 * e entrega tudo pronto pro Client Component cuidar da interação.
 *
 * Defesa em profundidade:
 *   - requireRegisterRecebimento() (admin ou operador)
 *   - evento precisa existir
 *   - evento precisa estar ATIVO (senão volta pro detalhe do evento)
 */
export default async function CampoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // 1️⃣ Permissão
  const result = await requireRegisterRecebimento()
  // Em página, o helper que devolve NextResponse não serve pra render;
  // mas se ele já redireciona internamente, ok. Aqui tratamos o caso de objeto.
  if ('user' in result === false) {
    redirect('/login')
  }

  const { id: eventoId } = await params

  // 2️⃣ Busca evento + locais + alimentos (com produto)
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      nome: true,
      status: true,
      locais: {
        select: { id: true, nome: true, endereco: true },
        orderBy: { nome: 'asc' },
      },
      alimentos: {
        select: {
          id: true,
          ordem: true,
          product: { select: { name: true, unit: true } },
        },
        orderBy: { ordem: 'asc' },
      },
    },
  })

  if (!evento) notFound()

  // 3️⃣ Só evento ATIVO permite registro de campo
  if (evento.status !== 'ATIVO') {
    redirect(`/eventos/${eventoId}`)
  }

  // 4️⃣ Achata pro formato que o cliente consome
  const locais = evento.locais.map((l) => ({
    id: l.id,
    nome: l.nome,
    endereco: l.endereco,
  }))

  const alimentos = evento.alimentos.map((a) => ({
    id: a.id,
    nome: a.product.name,
    unidade: a.product.unit,
  }))

  return (
    <CampoCliente
      eventoId={evento.id}
      eventoNome={evento.nome}
      locais={locais}
      alimentos={alimentos}
    />
  )
}
