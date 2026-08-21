import { NextResponse } from 'next/server'
import { jsonError, readAuthCookie } from '@/lib/http'
import { touchPresence } from '@/lib/session-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const auth = await readAuthCookie(code)
    const dto = await touchPresence(code, auth.playerId, auth.token)
    return NextResponse.json(dto)
  } catch (error) {
    return jsonError(error)
  }
}
