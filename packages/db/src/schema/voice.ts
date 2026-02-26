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
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'
import { contacts } from './crm'

export const callDirectionEnum = pgEnum('call_direction', ['inbound', 'outbound'])
export const callStatusEnum = pgEnum('call_status', [
  'initiated',
  'ringing',
  'answered',
  'completed',
  'failed',
  'no_answer',
  'busy',
  'voicemail',
])

export const campaignTypeEnum = pgEnum('campaign_type', [
  'voice',
  'sms',
  'email',
  'whatsapp',
  'mixed',
])

export const callLogs = pgTable('call_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  direction: callDirectionEnum('direction').notNull(),
  status: callStatusEnum('status').notNull().default('initiated'),
  fromNumber: text('from_number').notNull(),
  toNumber: text('to_number').notNull(),
  duration: integer('duration'), // seconds
  recordingUrl: text('recording_url'),
  transcript: text('transcript'),
  transcriptEmbedding: vector('transcript_embedding', { dimensions: 1536 }),
  sentimentScore: real('sentiment_score'),
  sentimentLabel: text('sentiment_label'),
  summary: text('summary'),
  telephonyProvider: text('telephony_provider'), // 'africas_talking' | 'twilio'
  providerCallId: text('provider_call_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: campaignTypeEnum('type').notNull(),
  status: text('status').notNull().default('draft'), // draft | scheduled | running | completed | paused | cancelled
  script: text('script'), // for voice campaigns
  message: text('message'), // for SMS/WhatsApp campaigns
  audience: jsonb('audience').$type<{
    contactIds?: string[]
    segmentIds?: string[]
    filters?: Record<string, unknown>
  }>().default({}),
  schedule: jsonb('schedule').$type<{
    startAt?: string
    timezone?: string
    dailyStartHour?: number
    dailyEndHour?: number
    daysOfWeek?: number[]
  }>().default({}),
  results: jsonb('results').$type<{
    totalContacts?: number
    contacted?: number
    answered?: number
    converted?: number
    failed?: number
  }>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const callLogsRelations = relations(callLogs, ({ one }) => ({
  tenant: one(tenants, { fields: [callLogs.tenantId], references: [tenants.id] }),
  contact: one(contacts, { fields: [callLogs.contactId], references: [contacts.id] }),
}))

export const campaignsRelations = relations(campaigns, ({ one }) => ({
  tenant: one(tenants, { fields: [campaigns.tenantId], references: [tenants.id] }),
}))
