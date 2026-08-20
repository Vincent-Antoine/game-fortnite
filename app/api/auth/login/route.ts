import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { loginUser } from '@/lib/user-service'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const user = await loginUser({ email: body.email ?? '', password: body.password ?? '' })
    return NextResponse.json(user)
  } catch (error) {
    return jsonError(error)
  }
}
