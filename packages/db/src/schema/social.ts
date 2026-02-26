import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'

export const socialPlatformEnum = pgEnum('social_platform', [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'youtube',
  'tiktok',
])

export const postStatusEnum = pgEnum('post_status', [
  'draft',
  'scheduled',
  'published',
  'failed',
  'cancelled',
])

export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  platform: socialPlatformEnum('platform').notNull(),
  accountId: text('account_id').notNull(), // Platform-specific account ID
  accountName: text('account_name').notNull(),
  accessToken: text('access_token'), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  profile: jsonb('profile').$type<{
    displayName?: string
    username?: string
    avatarUrl?: string
    followersCount?: number
    followingCount?: number
    bio?: string
  }>().default({}),
  isActive: text('is_active').default('yes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const socialPosts = pgTable('social_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  socialAccountId: uuid('social_account_id').references(() => socialAccounts.id, { onDelete: 'cascade' }),
  platform: socialPlatformEnum('platform').notNull(),
  content: text('content').notNull(),
  mediaUrls: text('media_urls').array().default([]),
  hashtags: text('hashtags').array().default([]),
  status: postStatusEnum('status').notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  platformPostId: text('platform_post_id'), // ID returned by platform after publishing
  metrics: jsonb('metrics').$type<{
    likes?: number
    comments?: number
    shares?: number
    reach?: number
    impressions?: number
    clicks?: number
    saves?: number
  }>().default({}),
  errorMessage: text('error_message'),
  aiGenerated: text('ai_generated').default('no'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const socialAccountsRelations = relations(socialAccounts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [socialAccounts.tenantId], references: [tenants.id] }),
  posts: many(socialPosts),
}))

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  tenant: one(tenants, { fields: [socialPosts.tenantId], references: [tenants.id] }),
  socialAccount: one(socialAccounts, { fields: [socialPosts.socialAccountId], references: [socialAccounts.id] }),
}))
