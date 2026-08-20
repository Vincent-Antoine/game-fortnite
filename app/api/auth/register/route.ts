import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { registerUser } from '@/lib/user-service'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string }
    const user = await registerUser({
      name: body.name ?? '',
      email: body.email ?? '',
      password: body.password ?? '',
    })
    return NextResponse.json(user)
  } catch (error) {
    return jsonError(error)
  }
}
