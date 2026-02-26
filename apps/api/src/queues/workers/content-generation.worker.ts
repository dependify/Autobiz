import { Worker } from 'bullmq'
import { getRedis } from '../../lib/redis'
import { logger } from '../../lib/logger'
import { getDb } from '@dependify/db'
import { contentPieces, tenants } from '@dependify/db'
import { eq } from 'drizzle-orm'
import { orchestrator } from '@dependify/orchestrator'
import { QUEUES } from '@dependify/config'
import type { ContentGenerationJob } from '../index'

export function startContentGenerationWorker() {
  const worker = new Worker<ContentGenerationJob>(
    QUEUES.CONTENT_GENERATION,
    async (job) => {
      logger.info({ jobId: job.id, type: job.data.type }, 'Generating content')

      const db = getDb()

      // Get tenant context
      const [tenant] = await db
        .select({ market: tenants.market, plan: tenants.plan, settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, job.data.tenantId))
        .limit(1)

      if (!tenant) throw new Error(`Tenant ${job.data.tenantId} not found`)

      // Build the prompt for orchestrator
      let prompt = ''
      if (job.data.type === 'blog' && job.data.input.keyword) {
        prompt = `Generate a blog post targeting the keyword "${job.data.input.keyword}" about: ${job.data.input.topic ?? job.data.input.keyword}`
      } else if (job.data.type === 'social' && job.data.input.platform) {
        prompt = `Generate a ${job.data.input.platform} post about: ${job.data.input.topic}`
      }

      const result = await orchestrator.process({
        message: prompt,
        context: {
          tenantId: job.data.tenantId,
          userId: 'system',
          market: tenant.market as 'NG' | 'US' | 'UK' | 'AU' | 'NZ' | 'CA',
          plan: tenant.plan,
          settings: (tenant.settings ?? {}) as Record<string, unknown>,
        },
      })

      // Update content piece with generated content
      await db
        .update(contentPieces)
        .set({
          body: result.response,
          status: 'review',
          aiGenerated: 'full',
          updatedAt: new Date(),
        })
        .where(eq(contentPieces.id, job.data.contentPieceId))

      logger.info({ contentId: job.data.contentPieceId, tokensUsed: result.tokensUsed }, 'Content generated')
    },
    {
      connection: getRedis(),
      concurrency: 3, // Limit concurrent AI calls
    }
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Content generation failed')
  })

  return worker
}
