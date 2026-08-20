import { NextResponse } from 'next/server'
import { jsonError, setAuthCookie } from '@/lib/http'
import { createSession } from '@/lib/session-service'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; stakeCents?: number; avatar?: string }
    const result = await createSession({
      name: body.name ?? '',
      avatar: body.avatar,
      stakeCents: body.stakeCents,
    })
    await setAuthCookie(result.dto.code, result.playerId, result.token)
    return NextResponse.json(result.dto)
  } catch (error) {
    return jsonError(error)
  }
}
