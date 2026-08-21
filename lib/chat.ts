import { ApiError } from './errors'

export const SESSION_PING_PRESETS = {
  launch: 'On lance',
  scores: 'Note tes scores',
  coming: 'J’arrive',
} as const

export type SessionPingPreset = keyof typeof SESSION_PING_PRESETS

const PING_COOLDOWN_MS = 10_000

export function sanitizeMessage(raw: string, max: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    throw new ApiError(400, 'Message vide')
  }
  if (cleaned.length > max) {
    throw new ApiError(400, `Message trop long (${max} max)`)
  }
  return cleaned
}

export function resolveSessionPing(input: { preset?: string; body?: string }): string {
  if (input.preset) {
    const body = SESSION_PING_PRESETS[input.preset as SessionPingPreset]
    if (!body) {
      throw new ApiError(400, 'Ping inconnu')
    }
    return body
  }
  return sanitizeMessage(input.body ?? '', 120)
}

export function pingTooSoon(lastAt: Date | null, now: Date = new Date()): boolean {
  if (!lastAt) {
    return false
  }
  return now.getTime() - lastAt.getTime() < PING_COOLDOWN_MS
}

export function allScoresConfirmed(rows: { confirmedAt: string | Date | null }[]): boolean {
  if (rows.length === 0) {
    return false
  }
  return rows.every((row) => Boolean(row.confirmedAt))
}

export const TYPING_WINDOW_MS = 4_000

export function isTyping(lastAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastAt) {
    return false
  }
  const stamp = lastAt instanceof Date ? lastAt.getTime() : Date.parse(lastAt)
  if (!Number.isFinite(stamp)) {
    return false
  }
  return now - stamp < TYPING_WINDOW_MS
}
