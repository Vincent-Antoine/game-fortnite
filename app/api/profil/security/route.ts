import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { updateAccountSecurity } from '@/lib/user-service'

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      currentPassword?: string
      email?: string
      password?: string
    }
    return NextResponse.json(
      await updateAccountSecurity({
        currentPassword: body.currentPassword ?? '',
        email: body.email,
        password: body.password,
      }),
    )
  } catch (error) {
    return jsonError(error)
  }
}
