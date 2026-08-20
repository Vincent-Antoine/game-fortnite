import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { profileStats } from '@/lib/user-service'

export async function GET() {
  try {
    return NextResponse.json(await profileStats())
  } catch (error) {
    return jsonError(error)
  }
}
