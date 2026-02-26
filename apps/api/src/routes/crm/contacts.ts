import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { getDb } from '@dependify/db'
import { contacts, interactions } from '@dependify/db'
import { eq, and, desc, ilike, sql } from 'drizzle-orm'
import { authMiddleware } from '../../middleware/auth'

const router = new Hono()

router.use('*', authMiddleware)

const createContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  tags: z.array(z.string()).default([]),
  stage: z.enum(['lead', 'prospect', 'qualified', 'proposal', 'customer', 'churned']).default('lead'),
  source: z.string().optional(),
  notes: z.string().optional(),
})

const updateContactSchema = createContactSchema.partial()

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  stage: z.enum(['lead', 'prospect', 'qualified', 'proposal', 'customer', 'churned']).optional(),
  source: z.string().optional(),
})

// List contacts
router.get('/', zValidator('query', listQuerySchema), async (c) => {
  const { page, limit, search, stage, source } = c.req.valid('query')
  const tenantId = c.get('tenantId')
  const db = getDb()

  const offset = (page - 1) * limit
  const conditions = [eq(contacts.tenantId, tenantId)]

  if (stage) conditions.push(eq(contacts.stage, stage))
  if (source) conditions.push(eq(contacts.source, source))
  if (search) {
    conditions.push(
      sql`(${contacts.name} ILIKE ${`%${search}%`} OR ${contacts.email} ILIKE ${`%${search}%`} OR ${contacts.company} ILIKE ${`%${search}%`})`
    )
  }

  const [rows, countResult] = await Promise.all([
    db.select().from(contacts).where(and(...conditions)).orderBy(desc(contacts.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(...conditions)),
  ])

  return c.json({
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(countResult[0]?.count ?? 0),
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limit),
    },
  })
})

// Get contact
router.get('/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const { id } = c.req.param()
  const db = getDb()

  const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).limit(1)

  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  // Get recent interactions
  const recentInteractions = await db
    .select()
    .from(interactions)
    .where(eq(interactions.contactId, id))
    .orderBy(desc(interactions.createdAt))
    .limit(10)

  return c.json({ ...contact, recentInteractions })
})

// Create contact
router.post('/', zValidator('json', createContactSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const data = c.req.valid('json')
  const db = getDb()

  const [contact] = await db.insert(contacts).values({ ...data, tenantId }).returning()

  return c.json(contact, 201)
})

// Update contact
router.patch('/:id', zValidator('json', updateContactSchema), async (c) => {
  const tenantId = c.get('tenantId')
  const { id } = c.req.param()
  const data = c.req.valid('json')
  const db = getDb()

  const [contact] = await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
    .returning()

  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  return c.json(contact)
})

// Delete contact
router.delete('/:id', async (c) => {
  const tenantId = c.get('tenantId')
  const { id } = c.req.param()
  const db = getDb()

  const [deleted] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
    .returning({ id: contacts.id })

  if (!deleted) return c.json({ error: 'Contact not found' }, 404)

  return c.json({ message: 'Contact deleted' })
})

// Add interaction
router.post('/:id/interactions', zValidator('json', z.object({
  type: z.enum(['email', 'call', 'meeting', 'note', 'sms', 'whatsapp', 'social']),
  content: z.string().min(1),
  direction: z.enum(['inbound', 'outbound']).optional(),
})), async (c) => {
  const tenantId = c.get('tenantId')
  const { id } = c.req.param()
  const data = c.req.valid('json')
  const db = getDb()

  const [contact] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).limit(1)
  if (!contact) return c.json({ error: 'Contact not found' }, 404)

  const [interaction] = await db.insert(interactions).values({
    contactId: id,
    tenantId,
    ...data,
  }).returning()

  // Update last contacted
  await db.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, id))

  return c.json(interaction, 201)
})

export { router as contactsRouter }
