import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { activatePower } from '@/lib/session-service'
import type { PowerKind } from '@/lib/scoring'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const body = (await request.json()) as {
      playerId?: string
      kind?: PowerKind
      targetPlayerId?: string | null
    }
    const dto = await activatePower({
      code,
      gameId,
      playerId: body.playerId ?? '',
      kind: body.kind ?? 'double',
      targetPlayerId: body.targetPlayerId ?? null,
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
