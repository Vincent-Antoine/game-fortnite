import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { listNotifications, markNotificationsRead } from '@/lib/user-service'

export async function GET() {
  try {
    return NextResponse.json(await listNotifications())
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST() {
  try {
    await markNotificationsRead()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
