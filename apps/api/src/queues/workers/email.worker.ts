import { Worker } from 'bullmq'
import { getRedis } from '../../lib/redis'
import { logger } from '../../lib/logger'
import { QUEUES } from '@dependify/config'
import type { EmailSendJob } from '../index'

async function sendEmail(job: EmailSendJob): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey) {
    logger.warn('RESEND_API_KEY not set, email not sent')
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: job.from ?? process.env.EMAIL_FROM ?? 'noreply@dependify.app',
      to: Array.isArray(job.to) ? job.to : [job.to],
      subject: job.subject,
      html: job.html,
      text: job.text,
      reply_to: job.replyTo,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Email send failed: ${error}`)
  }

  const result = await response.json() as { id: string }
  logger.info({ emailId: result.id, to: job.to, subject: job.subject }, 'Email sent')
}

export function startEmailWorker() {
  const worker = new Worker<EmailSendJob>(
    QUEUES.EMAIL_SEND,
    async (job) => {
      logger.info({ jobId: job.id, to: job.data.to }, 'Processing email job')
      await sendEmail(job.data)
    },
    {
      connection: getRedis(),
      concurrency: 10,
    }
  )

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Email sent successfully')
  })

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email send failed')
  })

  return worker
}
