import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '@dependify/db'
import { users, sessions, tenants } from '@dependify/db'
import { eq, and } from 'drizzle-orm'
import { getRedis } from '../../lib/redis'
import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(':')
  if (!salt || !key) return false
  const derivedKey = await scryptAsync(password, salt, 64) as Buffer
  const keyBuffer = Buffer.from(key, 'hex')
  return timingSafeEqual(derivedKey, keyBuffer)
}

function generateToken(): string {
  return randomBytes(32).toString('hex')
}

const router = new Hono()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  businessName: z.string().min(2),
  market: z.enum(['NG', 'US', 'UK', 'AU', 'NZ', 'CA']).default('NG'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

router.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name, businessName, market } = c.req.valid('json')
  const db = getDb()

  // Check if user exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length) {
    return c.json({ error: 'Email already registered' }, 409)
  }

  const passwordHash = await hashPassword(password)

  // Create tenant slug from business name
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  // Create tenant and user in a transaction
  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx.insert(tenants).values({
      name: businessName,
      slug: `${slug}-${randomBytes(3).toString('hex')}`,
      market: market as 'NG' | 'US' | 'UK' | 'AU' | 'NZ' | 'CA',
      plan: 'starter',
    }).returning({ id: tenants.id })

    if (!tenant) throw new Error('Failed to create tenant')

    const [user] = await tx.insert(users).values({
      tenantId: tenant.id,
      email,
      name,
      passwordHash,
      role: 'tenant_admin',
      authProvider: 'email',
    }).returning({ id: users.id, email: users.email, name: users.name, role: users.role })

    if (!user) throw new Error('Failed to create user')

    return { tenant, user }
  })

  return c.json({
    message: 'Account created successfully',
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    tenantId: result.tenant.id,
  }, 201)
})

router.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const db = getDb()

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = userResult[0]

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  // Create session
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(sessions).values({
    userId: user.id,
    token,
    expiresAt,
    ipAddress: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
  })

  // Cache session
  const redis = getRedis()
  await redis.setex(`session:${token}`, 300, JSON.stringify({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  }))

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    },
    expiresAt,
  })
})

router.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const db = getDb()
    const redis = getRedis()

    await db.delete(sessions).where(eq(sessions.token, token))
    await redis.del(`session:${token}`)
  }

  return c.json({ message: 'Logged out successfully' })
})

router.get('/me', async (c) => {
  const auth = c.get('auth')
  if (!auth) {
    return c.json({ error: 'Not authenticated' }, 401)
  }
  return c.json({ user: auth })
})

export { router as authRouter }
