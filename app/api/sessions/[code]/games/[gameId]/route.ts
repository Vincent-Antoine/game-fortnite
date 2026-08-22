import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { updateOpenGame } from '@/lib/session-service'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const body = (await request.json()) as {
      firstKillPlayerId?: string | null
      scores?: { playerId: string; kills: number; revives: number }[]
    }
    const dto = await updateOpenGame({
      code,
      gameId,
      ...(Object.prototype.hasOwnProperty.call(body, 'firstKillPlayerId')
        ? { firstKillPlayerId: body.firstKillPlayerId ?? null }
        : {}),
      scores: body.scores ?? [],
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
