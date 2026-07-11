import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

/**
 * 🆕 ONDA 17.8-f — Adiciona um LocalColeta ao evento.
 *
 * Defesa em profundidade:
 *   1. requireAdmin() → só admin
 *   2. evento existe
 *   3. evento NÃO pode estar ENCERRADO (cadeado)
 *   4. valida nome (obrigatório, trim)
 *   5. cria o local vinculado ao evento
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1️⃣ Permissão
  const result = await requireAdmin()
  if (result instanceof NextResponse) return result

  const { id: eventoId } = await params

  // 2️⃣ Evento existe
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })

  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 3️⃣ Evento não pode estar ENCERRADO
  if (evento.status === 'ENCERRADO') {
    return NextResponse.json(
      { error: 'Evento encerrado não pode ser alterado' },
      { status: 409 },
    )
  }

  // 4️⃣ Valida payload
  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const enderecoRaw = typeof body?.endereco === 'string' ? body.endereco.trim() : ''
  const endereco = enderecoRaw === '' ? null : enderecoRaw

  if (!nome) {
    return NextResponse.json({ error: 'Nome do local é obrigatório' }, { status: 400 })
  }

  // 5️⃣ Cria local
  const local = await prisma.localColeta.create({
    data: { eventoId, nome, endereco },
    select: { id: true, nome: true, endereco: true },
  })

  return NextResponse.json({ ok: true, local }, { status: 201 })
}
