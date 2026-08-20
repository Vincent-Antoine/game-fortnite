import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/errors'
import { jsonError } from '@/lib/http'
import { deleteNotification, listNotifications, markNotificationsRead } from '@/lib/user-service'

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

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string }
    if (!body.id) {
      throw new ApiError(400, 'Notification manquante')
    }
    await deleteNotification(body.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
