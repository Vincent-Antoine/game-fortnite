import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { setAccountPhoto } from '@/lib/user-service'

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { photoData?: string | null }
    return NextResponse.json(await setAccountPhoto(body.photoData ?? null))
  } catch (error) {
    return jsonError(error)
  }
}
