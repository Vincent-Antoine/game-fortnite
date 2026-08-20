import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { addPlayer } from '@/lib/session-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const body = (await request.json()) as { name?: string; avatar?: string; photoData?: string | null }
    const dto = await addPlayer({
      code,
      name: body.name ?? '',
      avatar: body.avatar,
      photoData: body.photoData,
    })
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
