import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { profileStats, setAccountName } from '@/lib/user-service'

export async function GET() {
  try {
    return NextResponse.json(await profileStats())
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { name?: string }
    return NextResponse.json(await setAccountName(body.name ?? ''))
  } catch (error) {
    return jsonError(error)
  }
}
