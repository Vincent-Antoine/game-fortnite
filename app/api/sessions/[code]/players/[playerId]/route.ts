import { NextResponse } from 'next/server'
import { jsonError, requireSessionPlayer, withYou } from '@/lib/http'
import { kickPlayer, renamePlayer } from '@/lib/session-service'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ code: string; playerId: string }> },
) {
  try {
    const { code, playerId } = await context.params
    const hostId = await requireSessionPlayer(code)
    const body = (await request.json()) as { name?: string }
    const dto = await renamePlayer(code, hostId, playerId, body.name ?? '')
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ code: string; playerId: string }> },
) {
  try {
    const { code, playerId } = await context.params
    const hostId = await requireSessionPlayer(code)
    const dto = await kickPlayer(code, hostId, playerId)
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
