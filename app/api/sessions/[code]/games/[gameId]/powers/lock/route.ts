import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { lockGamePowers } from '@/lib/session-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string; gameId: string }> },
) {
  try {
    const { code, gameId } = await context.params
    const dto = await lockGamePowers(code, gameId)
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
