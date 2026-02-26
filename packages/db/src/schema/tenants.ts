import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const planEnum = pgEnum('plan', ['starter', 'growth', 'scale', 'enterprise'])
export const marketEnum = pgEnum('market', ['NG', 'US', 'UK', 'AU', 'NZ', 'CA'])

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  market: marketEnum('market').notNull().default('NG'),
  plan: planEnum('plan').notNull().default('starter'),
  settings: jsonb('settings').$type<{
    timezone?: string
    logoUrl?: string
    brandColor?: string
    customDomain?: string
    onboardingCompleted?: boolean
  }>().default({}),
  isActive: boolean('is_active').notNull().default(true),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  subscriptionId: text('subscription_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'tenant_admin',
  'tenant_member',
  'client_viewer',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').notNull().default('tenant_member'),
  authProvider: text('auth_provider').notNull().default('email'),
  authProviderId: text('auth_provider_id'),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))
