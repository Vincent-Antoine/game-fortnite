import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'
import { listNotifications, touchUserPresence } from '@/lib/user-service'

export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ user: null, notifications: [] })
    }
    const live = new URL(request.url).searchParams.get('live') === '1'
    if (live) {
      await touchUserPresence(user.id)
    }
    const notifications = await listNotifications()
    return NextResponse.json({
      user: live ? { ...user, lastSeenAt: new Date().toISOString() } : user,
      notifications,
    })
  } catch (error) {
    return jsonError(error)
  }
}
