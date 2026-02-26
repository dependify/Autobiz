import type { Context, Next } from 'hono'
import { getDb } from '@dependify/db'
import { tenants } from '@dependify/db'
import { eq } from 'drizzle-orm'
import { cacheGet, cacheSet, cacheKey } from '../lib/redis'

export async function tenantMiddleware(c: Context, next: Next) {
  const tenantId = c.get('tenantId')

  if (!tenantId) {
    return next()
  }

  // Load tenant settings from cache or DB
  const cKey = cacheKey('tenant', tenantId)
  let tenant = await cacheGet<{ plan: string; market: string; settings: Record<string, unknown> }>(cKey)

  if (!tenant) {
    const db = getDb()
    const result = await db
      .select({ plan: tenants.plan, market: tenants.market, settings: tenants.settings, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)

    if (!result.length || !result[0]?.isActive) {
      return c.json({ error: 'Tenant not found or inactive' }, 403)
    }

    tenant = {
      plan: result[0].plan,
      market: result[0].market,
      settings: (result[0].settings ?? {}) as Record<string, unknown>,
    }

    // Cache for 10 minutes
    await cacheSet(cKey, tenant, 600)
  }

  c.set('tenant', tenant)

  return next()
}

declare module 'hono' {
  interface ContextVariableMap {
    tenant: {
      plan: string
      market: string
      settings: Record<string, unknown>
    }
  }
}
