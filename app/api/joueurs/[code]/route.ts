import { jsonError } from '@/lib/http'
import { getPlayerProfile } from '@/lib/user-service'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params
    return NextResponse.json(await getPlayerProfile(code))
  } catch (error) {
    return jsonError(error)
  }
}
