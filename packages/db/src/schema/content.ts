import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  vector,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'

export const contentTypeEnum = pgEnum('content_type', [
  'blog',
  'social',
  'email',
  'video',
  'podcast',
])

export const contentStatusEnum = pgEnum('content_status', [
  'idea',
  'draft',
  'review',
  'approved',
  'published',
  'archived',
])

export const contentPieces = pgTable('content_pieces', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: contentTypeEnum('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  excerpt: text('excerpt'),
  targetKeyword: text('target_keyword'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  tags: text('tags').array().default([]),
  status: contentStatusEnum('status').notNull().default('draft'),
  authorId: uuid('author_id'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  embedding: vector('embedding', { dimensions: 1536 }),
  performance: jsonb('performance').$type<{
    views?: number
    clicks?: number
    shares?: number
    comments?: number
    engagement?: number
  }>().default({}),
  aiGenerated: text('ai_generated').default('no'), // 'no' | 'partial' | 'full'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  keyword: text('keyword').notNull(),
  volume: integer('volume'),
  difficulty: integer('difficulty'), // 0-100
  currentPosition: integer('current_position'),
  targetPosition: integer('target_position'),
  url: text('url'), // which page is ranking
  isTracked: text('is_tracked').default('yes'),
  lastTrackedAt: timestamp('last_tracked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const contentPiecesRelations = relations(contentPieces, ({ one }) => ({
  tenant: one(tenants, { fields: [contentPieces.tenantId], references: [tenants.id] }),
}))

export const keywordsRelations = relations(keywords, ({ one }) => ({
  tenant: one(tenants, { fields: [keywords.tenantId], references: [tenants.id] }),
}))
