import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { normalizeCode } from '@/lib/code'
import { ApiError, identifyPlayer } from '@/lib/session-service'
import type { SessionDTO } from '@/lib/types'

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  if (error instanceof Error && error.message.includes('DATABASE_URL')) {
    return NextResponse.json(
      { error: 'Base de données non configurée. Ajoute DATABASE_URL (Neon).' },
      { status: 503 },
    )
  }
  console.error(error)
  return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
}

export async function readAuthCookie(code: string) {
  const jar = await cookies()
  const raw = jar.get(`dr_${normalizeCode(code)}`)?.value
  if (!raw) {
    return { playerId: undefined, token: undefined }
  }
  const [playerId, token] = raw.split('.')
  return { playerId, token }
}

export async function setAuthCookie(code: string, playerId: string, token: string) {
  const jar = await cookies()
  jar.set(`dr_${normalizeCode(code)}`, `${playerId}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 40,
  })
}

export async function withYou(code: string, dto: SessionDTO): Promise<SessionDTO> {
  const auth = await readAuthCookie(code)
  const youPlayerId = await identifyPlayer(code, auth.playerId, auth.token)
  return { ...dto, youPlayerId }
}
