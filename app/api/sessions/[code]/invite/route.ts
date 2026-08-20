import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { inviteFriend } from '@/lib/user-service'

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    const body = (await request.json()) as { friendUserId?: string }
    return NextResponse.json(await inviteFriend(code, body.friendUserId ?? ''))
  } catch (error) {
    return jsonError(error)
  }
}
