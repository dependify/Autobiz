import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  real,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'
import { contacts } from './crm'

export const proposalStatusEnum = pgEnum('proposal_status', [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
])

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  content: jsonb('content').$type<{
    sections: Array<{
      id: string
      type: 'text' | 'pricing' | 'timeline' | 'signature' | 'custom'
      title: string
      body: string
      data?: Record<string, unknown>
    }>
  }>().default({ sections: [] }),
  totalValue: real('total_value'),
  currency: text('currency').default('NGN'),
  status: proposalStatusEnum('status').notNull().default('draft'),
  templateId: uuid('template_id'),
  pdfUrl: text('pdf_url'),
  publicToken: text('public_token').unique(), // for sharing without auth
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  signatureData: jsonb('signature_data').$type<{
    signedAt?: string
    signerName?: string
    signerEmail?: string
    signatureImageUrl?: string
  }>().default({}),
  aiGenerated: text('ai_generated').default('no'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const proposalTemplates = pgTable('proposal_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = global template
  name: text('name').notNull(),
  industry: text('industry'),
  description: text('description'),
  content: jsonb('content').$type<{
    sections: Array<{
      id: string
      type: string
      title: string
      body: string
    }>
  }>().default({ sections: [] }),
  isPublic: text('is_public').default('no'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const proposalsRelations = relations(proposals, ({ one }) => ({
  tenant: one(tenants, { fields: [proposals.tenantId], references: [tenants.id] }),
  contact: one(contacts, { fields: [proposals.contactId], references: [contacts.id] }),
}))

export const proposalTemplatesRelations = relations(proposalTemplates, ({ one }) => ({
  tenant: one(tenants, { fields: [proposalTemplates.tenantId], references: [tenants.id] }),
}))
