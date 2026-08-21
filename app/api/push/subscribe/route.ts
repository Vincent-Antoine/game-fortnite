import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { deletePushSubscription, savePushSubscription } from '@/lib/push'
import { requireUser } from '@/lib/user-service'

export async function POST(request: Request) {
  try {
    const me = await requireUser()
    const body = (await request.json()) as {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
    if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 })
    }
    await savePushSubscription({
      userId: me.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    const me = await requireUser()
    const body = (await request.json()) as { endpoint?: string }
    if (!body.endpoint) {
      return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 })
    }
    await deletePushSubscription(body.endpoint, me.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
