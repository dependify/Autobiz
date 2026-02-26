/**
 * Platform-wide constants
 */

// Queue names (BullMQ)
export const QUEUES = {
  CONTENT_GENERATION: 'content-generation',
  EMAIL_SEND: 'email-send',
  VOICE_CALLS: 'voice-calls',
  SOCIAL_PUBLISH: 'social-publish',
  SEO_SYNC: 'seo-sync',
  REPORT_GENERATION: 'report-generation',
  CONTACT_ENRICH: 'contact-enrich',
  INVOICE_REMINDER: 'invoice-reminder',
} as const

// Job priority levels
export const JOB_PRIORITY = {
  REALTIME: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
} as const

// Cache TTLs (seconds)
export const CACHE_TTL = {
  SHORT: 60,           // 1 minute
  MEDIUM: 300,         // 5 minutes
  LONG: 3600,          // 1 hour
  DAILY: 86400,        // 24 hours
  WEEKLY: 604800,      // 7 days
  SEO_DATA: 3600,      // SEO API responses
  SOCIAL_METRICS: 3600, // Social media metrics
  CURRENCY_RATES: 3600, // Exchange rates
} as const

// Rate limits (requests per window)
export const RATE_LIMITS = {
  API_DEFAULT: { requests: 100, windowMs: 60000 },     // 100 req/min
  API_AI: { requests: 20, windowMs: 60000 },           // 20 AI req/min
  API_CONTENT: { requests: 10, windowMs: 60000 },      // 10 content gen/min
  API_VOICE: { requests: 5, windowMs: 60000 },         // 5 voice req/min
} as const

// AI model identifiers
export const AI_MODELS = {
  CLAUDE_SONNET: 'claude-sonnet-4-5',
  CLAUDE_HAIKU: 'claude-haiku-4-5',
  OLLAMA_LLAMA: 'llama3.1:8b',
} as const

// Tool categories
export const TOOL_CATEGORIES = [
  'crm',
  'content',
  'social',
  'finance',
  'voice',
  'seo',
  'website',
  'communication',
  'storage',
  'enrichment',
] as const

export type ToolCategory = (typeof TOOL_CATEGORIES)[number]

// Social platforms
export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'youtube',
  'tiktok',
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

// Content types
export const CONTENT_TYPES = ['blog', 'social', 'email', 'video', 'podcast'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

// Contact stages (CRM pipeline)
export const CONTACT_STAGES = ['lead', 'prospect', 'qualified', 'proposal', 'customer', 'churned'] as const
export type ContactStage = (typeof CONTACT_STAGES)[number]

// Deal stages
export const DEAL_STAGES = ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const
export type DealStage = (typeof DEAL_STAGES)[number]

// Invoice statuses
export const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

// Proposal statuses
export const PROPOSAL_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

// User roles
export const USER_ROLES = ['super_admin', 'tenant_admin', 'tenant_member', 'client_viewer'] as const
export type UserRole = (typeof USER_ROLES)[number]
