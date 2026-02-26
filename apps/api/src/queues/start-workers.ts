import { logger } from '../lib/logger'
import { startEmailWorker } from './workers/email.worker'
import { startSocialPublishWorker } from './workers/social-publish.worker'
import { startContentGenerationWorker } from './workers/content-generation.worker'

export function startAllWorkers() {
  const workers = [
    { name: 'email', start: startEmailWorker },
    { name: 'social-publish', start: startSocialPublishWorker },
    { name: 'content-generation', start: startContentGenerationWorker },
  ]

  const activeWorkers = workers.map(({ name, start }) => {
    try {
      const worker = start()
      logger.info({ worker: name }, 'Worker started')
      return worker
    } catch (err) {
      logger.error({ worker: name, err }, 'Failed to start worker')
      return null
    }
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, gracefully shutting down workers...')
    await Promise.all(activeWorkers.filter(Boolean).map((w) => w!.close()))
    process.exit(0)
  })

  logger.info(`${activeWorkers.filter(Boolean).length}/${workers.length} workers running`)
  return activeWorkers
}
