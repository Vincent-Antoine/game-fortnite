import { getAuthUser } from '@/lib/auth'
import { jsonError, setAuthCookie } from '@/lib/http'
import { joinSession } from '@/lib/session-service'
import { deleteNotificationsByHref } from '@/lib/user-service'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const body = (await request.json()) as { name?: string; avatar?: string; photoData?: string | null }
    const user = await getAuthUser()
    const result = await joinSession({
      code,
      name: body.name || user?.name || '',
      avatar: body.avatar,
      photoData: body.photoData,
      userId: user?.id ?? null,
    })
    await setAuthCookie(result.dto.code, result.playerId, result.token)
    if (user) {
      await deleteNotificationsByHref(`/session/${result.dto.code}`)
    }
    return NextResponse.json(result.dto)
  } catch (error) {
    return jsonError(error)
  }
}
