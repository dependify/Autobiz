import { Worker } from 'bullmq'
import { getRedis } from '../../lib/redis'
import { logger } from '../../lib/logger'
import { getDb } from '@dependify/db'
import { socialPosts } from '@dependify/db'
import { eq } from 'drizzle-orm'
import { QUEUES } from '@dependify/config'
import type { SocialPublishJob } from '../index'

async function publishToSocialPlatform(job: SocialPublishJob): Promise<string> {
  // Platform-specific publishing logic
  // Each platform has different API requirements
  switch (job.platform) {
    case 'instagram':
    case 'facebook': {
      // Facebook Graph API
      const pageId = job.accountId
      const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
      if (!accessToken) throw new Error('Facebook access token not configured')

      const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: job.content,
          access_token: accessToken,
        }),
      })

      if (!response.ok) {
        const err = await response.json() as { error?: { message: string } }
        throw new Error(`Facebook publish failed: ${err.error?.message}`)
      }

      const result = await response.json() as { id: string }
      return result.id
    }

    default:
      // Stub for other platforms (Twitter, LinkedIn, etc.)
      logger.warn({ platform: job.platform }, 'Platform publishing not yet implemented')
      return `stub-${Date.now()}`
  }
}

export function startSocialPublishWorker() {
  const worker = new Worker<SocialPublishJob>(
    QUEUES.SOCIAL_PUBLISH,
    async (job) => {
      logger.info({ jobId: job.id, platform: job.data.platform }, 'Publishing social post')

      const db = getDb()

      try {
        const platformPostId = await publishToSocialPlatform(job.data)

        // Update post status in DB
        await db
          .update(socialPosts)
          .set({
            status: 'published',
            publishedAt: new Date(),
            platformPostId,
            updatedAt: new Date(),
          })
          .where(eq(socialPosts.id, job.data.postId))

        logger.info({ postId: job.data.postId, platformPostId }, 'Social post published')
      } catch (err) {
        // Mark post as failed
        await db
          .update(socialPosts)
          .set({
            status: 'failed',
            errorMessage: String(err),
            updatedAt: new Date(),
          })
          .where(eq(socialPosts.id, job.data.postId))

        throw err
      }
    },
    {
      connection: getRedis(),
      concurrency: 5,
    }
  )

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Social publish failed')
  })

  return worker
}
