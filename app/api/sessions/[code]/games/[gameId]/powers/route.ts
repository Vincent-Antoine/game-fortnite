import { NextResponse } from 'next/server'
import { jsonError, requireSessionPlayer, withYou } from '@/lib/http'
import { togglePower } from '@/lib/session-service'
import type { PowerKind } from '@/lib/scoring'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const playerId = await requireSessionPlayer(code)
    const body = (await request.json()) as {
      kind?: PowerKind
      targetPlayerId?: string | null
    }
    const dto = await togglePower({
      code,
      gameId,
      playerId,
      kind: body.kind ?? 'double',
      targetPlayerId: body.targetPlayerId ?? null,
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
