import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
  real,
  boolean,
  integer,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants, users } from './tenants'
import { contacts } from './crm'

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'cancelled',
])

export const transactionTypeEnum = pgEnum('transaction_type', [
  'income',
  'expense',
  'transfer',
])

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  invoiceNumber: text('invoice_number').notNull(),
  lineItems: jsonb('line_items').$type<Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>>().notNull().default([]),
  subtotal: real('subtotal').notNull().default(0),
  taxRate: real('tax_rate').default(0),
  taxAmount: real('tax_amount').default(0),
  discount: real('discount').default(0),
  total: real('total').notNull().default(0),
  currency: text('currency').notNull().default('NGN'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  notes: text('notes'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentReference: text('payment_reference'),
  paymentProvider: text('payment_provider'), // 'paystack' | 'stripe' | 'flutterwave'
  paymentLink: text('payment_link'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  remindersSent: integer('reminders_sent').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  type: transactionTypeEnum('type').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('NGN'),
  category: text('category'),
  description: text('description'),
  reference: text('reference'),
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Relations
export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  contact: one(contacts, { fields: [invoices.contactId], references: [contacts.id] }),
  transactions: many(transactions),
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  tenant: one(tenants, { fields: [transactions.tenantId], references: [tenants.id] }),
  invoice: one(invoices, { fields: [transactions.invoiceId], references: [invoices.id] }),
}))
