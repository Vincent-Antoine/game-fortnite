import { NextResponse } from 'next/server'
import { jsonError, readAuthCookie } from '@/lib/http'
import { getSessionDto, identifyPlayer } from '@/lib/session-service'

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const auth = await readAuthCookie(code)
    const youPlayerId = await identifyPlayer(code, auth.playerId, auth.token)
    const dto = await getSessionDto(code, youPlayerId)
    return NextResponse.json(dto)
  } catch (error) {
    return jsonError(error)
  }
}
