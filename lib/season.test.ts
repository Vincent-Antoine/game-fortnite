import { describe, expect, it } from 'vitest'
import { seasonWindow } from './season'

describe('seasonWindow', () => {
  it('borne le mois calendaire à Paris', () => {
    const now = new Date('2026-08-21T12:00:00+02:00')
    const { from, to } = seasonWindow('month', now)
    expect(from?.toISOString()).toBe('2026-07-31T22:00:00.000Z')
    expect(to.toISOString()).toBe(now.toISOString())
  })

  it('borne la semaine au lundi Paris', () => {
    const friday = new Date('2026-08-21T12:00:00+02:00')
    const { from } = seasonWindow('week', friday)
    expect(from?.toISOString()).toBe('2026-08-16T22:00:00.000Z')
  })

  it('n’a pas de début pour tout le temps', () => {
    const now = new Date('2026-08-21T12:00:00Z')
    const { from, to } = seasonWindow('all', now)
    expect(from).toBeNull()
    expect(to).toBe(now)
  })
})
