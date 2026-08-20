import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { jsonError, readAuthCookie } from '@/lib/http'
import { getSessionDto, identifyPlayer, identifyPlayerByUser } from '@/lib/session-service'

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const auth = await readAuthCookie(code)
    let youPlayerId = await identifyPlayer(code, auth.playerId, auth.token)
    if (!youPlayerId) {
      const user = await getAuthUser()
      if (user) {
        youPlayerId = await identifyPlayerByUser(code, user.id)
      }
    }
    const dto = await getSessionDto(code, youPlayerId)
    return NextResponse.json(dto)
  } catch (error) {
    return jsonError(error)
  }
}
