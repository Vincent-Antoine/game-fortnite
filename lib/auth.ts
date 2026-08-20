import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { userSessions, users } from '@/lib/db/schema'

export type AuthUser = {
  id: string
  email: string
  name: string
  friendCode: string
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function setUserCookie(sessionId: string, token: string) {
  const jar = await cookies()
  jar.set('dr_user', `${sessionId}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 60,
  })
}

export async function clearUserCookie() {
  const jar = await cookies()
  jar.delete('dr_user')
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const jar = await cookies()
  const raw = jar.get('dr_user')?.value
  if (!raw) {
    return null
  }
  const [sessionId, token] = raw.split('.')
  if (!sessionId || !token) {
    return null
  }
  const db = getDb()
  const [row] = await db.select().from(userSessions).where(eq(userSessions.id, sessionId)).limit(1)
  if (!row || row.tokenHash !== hashToken(token)) {
    return null
  }
  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1)
  if (!user) {
    return null
  }
  return { id: user.id, email: user.email, name: user.name, friendCode: user.friendCode }
}

export function newToken(): string {
  return randomBytes(24).toString('hex')
}
