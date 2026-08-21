import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { publicVapidKey } from '@/lib/push'

export async function GET() {
  try {
    const key = publicVapidKey()
    if (!key) {
      return NextResponse.json({ error: 'Push non configuré' }, { status: 503 })
    }
    return NextResponse.json({ key })
  } catch (error) {
    return jsonError(error)
  }
}
