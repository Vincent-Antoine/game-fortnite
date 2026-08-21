import { jsonError } from '@/lib/http'
import { friendLeaderboard } from '@/lib/user-service'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json(await friendLeaderboard())
  } catch (error) {
    return jsonError(error)
  }
}
