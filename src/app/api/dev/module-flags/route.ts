import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getModuleFlags,
  HIDEABLE_MODULES,
} from '@/lib/module-flags'
import type { Module } from '@/lib/permissions'

/** GET — qualquer usuário logado lê (a sidebar precisa saber o que ocultar). */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const flags = await getModuleFlags()
  return NextResponse.json(
    { flags },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

/** PATCH — 🔒 EXCLUSIVO do dev. Backend nunca confia no frontend. */
export async function PATCH(req: Request) {
  const session = await auth()
  const role = session?.user?.role

  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (role !== 'dev') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  let body: { module?: string; enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { module, enabled } = body

  if (typeof module !== 'string' || !HIDEABLE_MODULES.includes(module as Module)) {
    return NextResponse.json(
      { error: 'Módulo inválido ou não ocultável' },
      { status: 400 },
    )
  }
  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Campo "enabled" inválido' }, { status: 400 })
  }

  const flag = await prisma.moduleFlag.upsert({
    where: { module },
    create: { module, enabled, updatedBy: session.user.email ?? null },
    update: { enabled, updatedBy: session.user.email ?? null },
    select: { module: true, enabled: true },
  })

  return NextResponse.json({ ok: true, flag })
}
