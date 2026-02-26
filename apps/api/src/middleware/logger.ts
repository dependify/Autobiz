import type { Context, Next } from 'hono'
import { logger } from '../lib/logger'

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now()
  const { method, url } = c.req.raw

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  logger.info({
    method,
    url,
    status,
    duration,
    tenantId: c.get('tenantId'),
  }, 'Request completed')
}
