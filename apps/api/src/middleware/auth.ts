import type { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getRedis } from '../lib/redis'
import { getDb } from '@dependify/db'
import { sessions, users } from '@dependify/db'
import { eq } from 'drizzle-orm'

export interface AuthContext {
  userId: string
  tenantId: string
  role: string
  email: string
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext
    tenantId: string
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const token = extractToken(c)

  if (!token) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  // Check Redis cache first
  const redis = getRedis()
  const cached = await redis.get(`session:${token}`)

  if (cached) {
    const auth = JSON.parse(cached) as AuthContext
    c.set('auth', auth)
    c.set('tenantId', auth.tenantId)
    return next()
  }

  // Fall back to database
  const db = getDb()
  const session = await db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      userEmail: users.email,
      userName: users.name,
      userRole: users.role,
      userTenantId: users.tenantId,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1)

  if (!session.length || !session[0]) {
    throw new HTTPException(401, { message: 'Invalid or expired session' })
  }

  const s = session[0]

  if (new Date(s.expiresAt) < new Date()) {
    throw new HTTPException(401, { message: 'Session expired' })
  }

  if (!s.userTenantId) {
    throw new HTTPException(403, { message: 'No tenant associated with this account' })
  }

  const auth: AuthContext = {
    userId: s.userId,
    tenantId: s.userTenantId,
    role: s.userRole,
    email: s.userEmail,
  }

  // Cache session for 5 minutes
  await redis.setex(`session:${token}`, 300, JSON.stringify(auth))

  c.set('auth', auth)
  c.set('tenantId', auth.tenantId)

  return next()
}

function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  // Also check cookie
  const cookie = c.req.header('Cookie')
  if (cookie) {
    const match = cookie.match(/session=([^;]+)/)
    if (match) return match[1] ?? null
  }

  return null
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth')
    if (!auth || !roles.includes(auth.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' })
    }
    return next()
  }
}
