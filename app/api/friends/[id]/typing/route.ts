import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { setTyping } from '@/lib/user-service'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    return NextResponse.json(await setTyping(id))
  } catch (error) {
    return jsonError(error)
  }
}
