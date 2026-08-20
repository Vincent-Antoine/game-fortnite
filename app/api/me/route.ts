import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { jsonError } from '@/lib/http'
import { listNotifications } from '@/lib/user-service'

export async function GET() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ user: null, notifications: [] })
    }
    const notifications = await listNotifications()
    return NextResponse.json({ user, notifications })
  } catch (error) {
    return jsonError(error)
  }
}
