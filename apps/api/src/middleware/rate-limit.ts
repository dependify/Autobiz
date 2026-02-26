import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getRedis } from '../lib/redis'
import { RATE_LIMITS } from '@dependify/config'

type RateLimitConfig = { requests: number; windowMs: number }

export function rateLimiter(config: RateLimitConfig = RATE_LIMITS.API_DEFAULT) {
  return async (c: Context, next: Next) => {
    const redis = getRedis()
    const tenantId = c.get('tenantId') ?? c.req.header('X-Forwarded-For') ?? 'anonymous'
    const key = `ratelimit:${tenantId}:${c.req.path}`

    const current = await redis.incr(key)

    if (current === 1) {
      await redis.pexpire(key, config.windowMs)
    }

    if (current > config.requests) {
      throw new HTTPException(429, { message: 'Rate limit exceeded. Please slow down.' })
    }

    c.header('X-RateLimit-Limit', String(config.requests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.requests - current)))

    return next()
  }
}
