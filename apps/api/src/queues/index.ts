import { Queue, QueueEvents } from 'bullmq'
import { getRedis } from '../lib/redis'
import { QUEUES } from '@dependify/config'

// Shared queue connection options
function getQueueConnection() {
  const redis = getRedis()
  return redis
}

// Queue factory - creates a queue with standard config
function createQueue(name: string) {
  return new Queue(name, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })
}

// All queues
export const contentGenerationQueue = createQueue(QUEUES.CONTENT_GENERATION)
export const emailSendQueue = createQueue(QUEUES.EMAIL_SEND)
export const voiceCallsQueue = createQueue(QUEUES.VOICE_CALLS)
export const socialPublishQueue = createQueue(QUEUES.SOCIAL_PUBLISH)
export const seoSyncQueue = createQueue(QUEUES.SEO_SYNC)
export const reportGenerationQueue = createQueue(QUEUES.REPORT_GENERATION)
export const contactEnrichQueue = createQueue(QUEUES.CONTACT_ENRICH)
export const invoiceReminderQueue = createQueue(QUEUES.INVOICE_REMINDER)

// Job type definitions
export interface ContentGenerationJob {
  tenantId: string
  contentPieceId: string
  type: 'blog' | 'social' | 'email'
  input: {
    keyword?: string
    topic?: string
    platform?: string
    tone?: string
  }
}

export interface EmailSendJob {
  tenantId: string
  to: string | string[]
  from?: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  metadata?: Record<string, unknown>
}

export interface SocialPublishJob {
  tenantId: string
  postId: string
  platform: string
  content: string
  mediaUrls?: string[]
  accountId: string
}

export interface InvoiceReminderJob {
  tenantId: string
  invoiceId: string
  contactEmail: string
  contactName: string
  invoiceNumber: string
  amount: number
  currency: string
  dueDate: string
  reminderNumber: number
}

export interface ContactEnrichJob {
  tenantId: string
  contactId: string
  email?: string
  domain?: string
}

export interface VoiceCallJob {
  tenantId: string
  campaignId: string
  contactId: string
  phoneNumber: string
  script: string
  provider: 'africas_talking' | 'twilio'
}

// Helper to add jobs with proper typing
export async function scheduleEmailSend(data: EmailSendJob, delay?: number) {
  return emailSendQueue.add('send', data, { delay })
}

export async function scheduleContentGeneration(data: ContentGenerationJob, priority?: number) {
  return contentGenerationQueue.add('generate', data, { priority })
}

export async function scheduleSocialPublish(data: SocialPublishJob, delay?: number) {
  return socialPublishQueue.add('publish', data, { delay })
}

export async function scheduleInvoiceReminder(data: InvoiceReminderJob, delay: number) {
  return invoiceReminderQueue.add(`reminder-${data.invoiceId}-${data.reminderNumber}`, data, {
    delay,
    jobId: `invoice-reminder-${data.invoiceId}-${data.reminderNumber}`, // Prevents duplicates
  })
}

export async function scheduleContactEnrich(data: ContactEnrichJob) {
  return contactEnrichQueue.add('enrich', data, {
    jobId: `enrich-${data.contactId}`, // Prevents duplicate enrich jobs
  })
}
