import { jsonError } from '@/lib/http'
import { removeSessionFromProfile } from '@/lib/user-service'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    return NextResponse.json(await removeSessionFromProfile(code))
  } catch (error) {
    return jsonError(error)
  }
}
