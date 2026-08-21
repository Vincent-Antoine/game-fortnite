export const LIVE_WINDOW_MS = 20_000

export function isPlayerLive(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) {
    return false
  }
  const stamp = lastSeenAt instanceof Date ? lastSeenAt.getTime() : Date.parse(lastSeenAt)
  if (!Number.isFinite(stamp)) {
    return false
  }
  return now - stamp < LIVE_WINDOW_MS
}
