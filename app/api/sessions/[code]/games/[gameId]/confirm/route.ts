import { NextResponse } from 'next/server'
import { jsonError, requireSessionPlayer, withYou } from '@/lib/http'
import { confirmOwnScore } from '@/lib/session-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const playerId = await requireSessionPlayer(code)
    const dto = await confirmOwnScore(code, gameId, playerId)
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
