import { NextResponse } from 'next/server'
import { jsonError, withYou } from '@/lib/http'
import { closeSession } from '@/lib/session-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const dto = await closeSession(code)
    return NextResponse.json(await withYou(code, dto))
  } catch (error) {
    return jsonError(error)
  }
}
