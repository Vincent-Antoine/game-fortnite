import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { profileStats, setAccountName, deleteAccount } from '@/lib/user-service'

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

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { password?: string }
    return NextResponse.json(await deleteAccount(body.password ?? ''))
  } catch (error) {
    return jsonError(error)
  }
}
