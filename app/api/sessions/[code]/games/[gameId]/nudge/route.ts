import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { nudgeScore } from '@/lib/session-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const body = (await request.json()) as { playerId?: string; killsDelta?: number; revivesDelta?: number }
    const dto = await nudgeScore({
      code,
      gameId,
      playerId: body.playerId ?? '',
      killsDelta: body.killsDelta,
      revivesDelta: body.revivesDelta,
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
