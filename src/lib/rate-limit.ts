import { createHash } from 'crypto'
import { prisma } from './prisma'

export type RateLimitResult = {
  allowed: boolean
  count: number
  retryAfterSec: number
}

function hashKey(scope: string, value: string): string {
  return createHash('sha256').update(`${scope}:${value}`).digest('hex')
}

/**
 * Incrementa o contador de forma atômica (um único UPSERT).
 * Seguro com várias instâncias da Vercel em paralelo.
 */
export async function hitRateLimit(
  scope: string,
  value: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const key = hashKey(scope, value)

  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "rate_limits" ("key", "count", "windowStart")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."windowStart" < NOW() - make_interval(secs => ${windowSec}::double precision)
        THEN 1 ELSE "rate_limits"."count" + 1 END,
      "windowStart" = CASE
        WHEN "rate_limits"."windowStart" < NOW() - make_interval(secs => ${windowSec}::double precision)
        THEN NOW() ELSE "rate_limits"."windowStart" END
    RETURNING "count", "windowStart"
  `

  const { count, windowStart } = rows[0]
  const resetAt = new Date(windowStart).getTime() + windowSec * 1000
  const retryAfterSec = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))

  return { allowed: count <= limit, count, retryAfterSec }
}

export async function resetRateLimit(scope: string, value: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: hashKey(scope, value) } })
}
