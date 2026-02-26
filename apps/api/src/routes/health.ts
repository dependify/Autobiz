import { Hono } from 'hono'
import { getRedis } from '../lib/redis'
import { getDb } from '@dependify/db'
import { sql } from 'drizzle-orm'

const router = new Hono()

router.get('/', async (c) => {
  const checks: Record<string, string> = {}

  // Database check
  try {
    const db = getDb()
    await db.execute(sql`SELECT 1`)
    checks['database'] = 'healthy'
  } catch {
    checks['database'] = 'unhealthy'
  }

  // Redis check
  try {
    const redis = getRedis()
    await redis.ping()
    checks['redis'] = 'healthy'
  } catch {
    checks['redis'] = 'unhealthy'
  }

  const allHealthy = Object.values(checks).every((v) => v === 'healthy')

  return c.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '0.1.0',
    checks,
  }, allHealthy ? 200 : 503)
})

export { router as healthRouter }
