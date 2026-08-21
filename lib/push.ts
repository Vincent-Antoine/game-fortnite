import webpush from 'web-push'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'

export type PushPayload = {
  title: string
  body: string
  href: string
}

function vapidConfigured(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return false
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://game-fortnite.vercel.app', publicKey, privateKey)
  return true
}

export function publicVapidKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

export async function savePushSubscription(input: {
  userId: string
  endpoint: string
  p256dh: string
  auth: string
}) {
  const db = getDb()
  await db
    .insert(pushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
      },
    })
}

export async function deletePushSubscription(endpoint: string, userId: string) {
  const db = getDb()
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!vapidConfigured()) {
    return
  }
  const db = getDb()
  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const body = JSON.stringify(payload)
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          body,
        )
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, row.endpoint))
        }
      }
    }),
  )
}
