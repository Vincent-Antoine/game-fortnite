import { describe, expect, it } from 'vitest'
import { LIVE_WINDOW_MS, isPlayerLive } from './presence'

describe('isPlayerLive', () => {
  it('est live si lastSeen est dans la fenêtre', () => {
    const now = 1_000_000
    expect(isPlayerLive(new Date(now - LIVE_WINDOW_MS + 1), now)).toBe(true)
    expect(isPlayerLive(new Date(now - LIVE_WINDOW_MS - 1), now)).toBe(false)
    expect(isPlayerLive(null, now)).toBe(false)
  })
})
