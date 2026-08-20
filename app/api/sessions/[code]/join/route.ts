import { NextResponse } from 'next/server'
import { jsonError, setAuthCookie } from '@/lib/http'
import { joinSession } from '@/lib/session-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const body = (await request.json()) as { name?: string }
    const result = await joinSession({ code, name: body.name ?? '' })
    await setAuthCookie(result.dto.code, result.playerId, result.token)
    return NextResponse.json(result.dto)
  } catch (error) {
    return jsonError(error)
  }
}
