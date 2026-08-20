import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { setPlayerPhoto } from '@/lib/session-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const body = (await request.json()) as { playerId?: string; photoData?: string | null }
    const dto = await setPlayerPhoto({
      code,
      playerId: body.playerId ?? '',
      photoData: body.photoData ?? null,
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
