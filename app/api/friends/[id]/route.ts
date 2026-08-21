import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { removeFriend } from '@/lib/user-service'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    return NextResponse.json(await removeFriend(id))
  } catch (error) {
    return jsonError(error)
  }
}
