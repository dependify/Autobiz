import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Connection pool singleton
let client: ReturnType<typeof postgres> | null = null

function getClient() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required')
    }
    client = postgres(connectionString, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }
  return client
}

export function getDb() {
  return drizzle(getClient(), { schema })
}

export type Database = ReturnType<typeof getDb>
export { schema }
