import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function sslFor(url: string): 'require' | false {
  return url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require'
}

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null

export function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL manquante')
  }
  if (!cached) {
    const client = postgres(url, {
      max: 1,
      prepare: false,
      ssl: sslFor(url),
    })
    cached = drizzle(client, { schema })
  }
  return cached
}
