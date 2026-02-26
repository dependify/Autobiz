import { Redis } from 'ioredis'
import { logger } from './logger'

let redisClient: Redis | null = null

export function getRedis(): Redis {
  if (!redisClient) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })

    redisClient.on('error', (err) => {
      logger.error({ err }, 'Redis connection error')
    })

    redisClient.on('ready', () => {
      logger.info('Redis connected')
    })
  }
  return redisClient
}

// Cache helpers
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  const value = await redis.get(key)
  if (!value) return null
  return JSON.parse(value) as T
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  await redis.setex(key, ttlSeconds, JSON.stringify(value))
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis()
  await redis.del(key)
}

export function cacheKey(...parts: string[]): string {
  return parts.join(':')
}
