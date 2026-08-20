import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { addFriendByCode, listFriends } from '@/lib/user-service'

export async function GET() {
  try {
    return NextResponse.json(await listFriends())
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string }
    return NextResponse.json(await addFriendByCode(body.code ?? ''))
  } catch (error) {
    return jsonError(error)
  }
}
