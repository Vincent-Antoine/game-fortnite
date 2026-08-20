import { getAuthUser } from '@/lib/auth'
import { jsonError, setAuthCookie } from '@/lib/http'
import { createSession } from '@/lib/session-service'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string
      stakeCents?: number
      avatar?: string
      photoData?: string | null
    }
    const user = await getAuthUser()
    const result = await createSession({
      name: body.name || user?.name || '',
      avatar: body.avatar,
      photoData: body.photoData,
      stakeCents: body.stakeCents,
      userId: user?.id ?? null,
    })
    await setAuthCookie(result.dto.code, result.playerId, result.token)
    return NextResponse.json(result.dto)
  } catch (error) {
    return jsonError(error)
  }
}
