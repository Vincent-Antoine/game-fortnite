import { getDb } from '@/lib/db'
import { notifications } from '@/lib/db/schema'
import { sendPushToUser } from '@/lib/push'

export async function notifyUser(
  userId: string,
  note: { type: string; title: string; href: string; body: string },
) {
  const db = getDb()
  await db.insert(notifications).values({
    userId,
    type: note.type,
    title: note.title,
    href: note.href,
  })
  await sendPushToUser(userId, { title: note.title, body: note.body, href: note.href })
}
