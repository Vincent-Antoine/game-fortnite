import { NextResponse } from 'next/server'
import { jsonError, requireSessionPlayer, withYou } from '@/lib/http'
import { sendSessionPing } from '@/lib/session-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const playerId = await requireSessionPlayer(code)
    const body = (await request.json()) as { preset?: string; body?: string }
    const dto = await sendSessionPing(code, playerId, body)
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
