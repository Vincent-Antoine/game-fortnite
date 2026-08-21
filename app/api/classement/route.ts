import { jsonError } from '@/lib/http'
import { parseSeasonRange } from '@/lib/season'
import { friendLeaderboard } from '@/lib/user-service'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const range = parseSeasonRange(new URL(request.url).searchParams.get('range'))
    return NextResponse.json(await friendLeaderboard(range))
  } catch (error) {
    return jsonError(error)
  }
}
