import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { listDirectMessages, sendDirectMessage } from '@/lib/user-service'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    return NextResponse.json(await listDirectMessages(id))
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const body = (await request.json()) as { body?: string }
    return NextResponse.json(await sendDirectMessage(id, body.body ?? ''))
  } catch (error) {
    return jsonError(error)
  }
}
