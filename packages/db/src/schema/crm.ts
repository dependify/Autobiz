import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  integer,
  real,
  vector,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'

export const contactStageEnum = pgEnum('contact_stage', [
  'lead',
  'prospect',
  'qualified',
  'proposal',
  'customer',
  'churned',
])

export const dealStageEnum = pgEnum('deal_stage', [
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
])

export const interactionTypeEnum = pgEnum('interaction_type', [
  'email',
  'call',
  'meeting',
  'note',
  'sms',
  'whatsapp',
  'social',
])

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  tags: text('tags').array().default([]),
  stage: contactStageEnum('stage').notNull().default('lead'),
  source: text('source'), // e.g. 'website', 'referral', 'social', 'cold_outreach'
  leadScore: integer('lead_score').default(0),
  notes: text('notes'),
  avatarUrl: text('avatar_url'),
  location: text('location'),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: interactionTypeEnum('type').notNull(),
  content: text('content').notNull(),
  sentimentScore: real('sentiment_score'), // -1.0 to 1.0
  sentimentLabel: text('sentiment_label'), // 'positive', 'neutral', 'negative'
  direction: text('direction'), // 'inbound', 'outbound'
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  stage: dealStageEnum('stage').notNull().default('discovery'),
  value: real('value').notNull().default(0),
  currency: text('currency').notNull().default('NGN'),
  probability: integer('probability').default(50), // 0-100
  closeDate: timestamp('close_date', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contacts.tenantId], references: [tenants.id] }),
  interactions: many(interactions),
  deals: many(deals),
}))

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, { fields: [interactions.contactId], references: [contacts.id] }),
  tenant: one(tenants, { fields: [interactions.tenantId], references: [tenants.id] }),
}))

export const dealsRelations = relations(deals, ({ one }) => ({
  tenant: one(tenants, { fields: [deals.tenantId], references: [tenants.id] }),
  contact: one(contacts, { fields: [deals.contactId], references: [contacts.id] }),
}))
