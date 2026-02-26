import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'
import { serve } from '@hono/node-server'
import { logger } from './lib/logger'
import { loggerMiddleware } from './middleware/logger'
import { rateLimiter } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'
import { tenantMiddleware } from './middleware/tenant'
import { healthRouter } from './routes/health'
import { authRouter } from './routes/auth'
import { crmRouter } from './routes/crm'

const app = new Hono()

// Global middleware
app.use('*', cors({
  origin: process.env.DASHBOARD_URL ?? 'http://localhost:3000',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,
}))
app.use('*', compress())
app.use('*', secureHeaders())
app.use('*', loggerMiddleware)
app.use('/api/*', rateLimiter())

// Health check (no auth)
app.route('/health', healthRouter)

// Auth routes (no tenant middleware needed)
app.route('/api/auth', authRouter)

// Protected API routes
app.use('/api/*', authMiddleware)
app.use('/api/*', tenantMiddleware)

// Feature routes
app.route('/api/crm', crmRouter)

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Route not found' }, 404)
})

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error')
  
  if (err.message && 'status' in err) {
    const httpErr = err as { status: number; message: string }
    return c.json({ error: httpErr.message }, httpErr.status as 400 | 401 | 403 | 404 | 429 | 500)
  }

  return c.json({ error: 'Internal server error' }, 500)
})

const port = Number(process.env.PORT ?? 4000)

serve({
  fetch: app.fetch,
  port,
}, () => {
  logger.info(`Dependify API running on port ${port}`)
})

export default app
