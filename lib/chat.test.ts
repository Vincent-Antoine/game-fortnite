import { describe, expect, it } from 'vitest'
import {
  allScoresConfirmed,
  pingTooSoon,
  resolveSessionPing,
  sanitizeMessage,
  SESSION_PING_PRESETS,
} from './chat'

describe('sanitizeMessage', () => {
  it('refuse un message vide', () => {
    expect(() => sanitizeMessage('   ', 120)).toThrow('Message vide')
  })

  it('coupe les espaces et refuse trop long', () => {
    expect(sanitizeMessage('  salut  ', 120)).toBe('salut')
    expect(() => sanitizeMessage('x'.repeat(121), 120)).toThrow('trop long')
  })
})

describe('resolveSessionPing', () => {
  it('utilise les phrases toutes faites', () => {
    expect(resolveSessionPing({ preset: 'launch' })).toBe('On lance')
    expect(SESSION_PING_PRESETS.scores).toBe('Note tes scores')
  })

  it('accepte un texte libre court', () => {
    expect(resolveSessionPing({ body: 'Café ?' })).toBe('Café ?')
  })
})

describe('pingTooSoon', () => {
  it('bloque un 2e ping dans les 10 secondes', () => {
    const first = new Date('2026-08-21T13:00:00Z')
    const second = new Date('2026-08-21T13:00:09Z')
    expect(pingTooSoon(first, second)).toBe(true)
    expect(pingTooSoon(first, new Date('2026-08-21T13:00:10Z'))).toBe(false)
    expect(pingTooSoon(null, second)).toBe(false)
  })
})

describe('allScoresConfirmed', () => {
  it('exige une confirmation par joueur', () => {
    expect(
      allScoresConfirmed([
        { confirmedAt: '2026-08-21T13:00:00Z' },
        { confirmedAt: null },
      ]),
    ).toBe(false)
    expect(
      allScoresConfirmed([
        { confirmedAt: '2026-08-21T13:00:00Z' },
        { confirmedAt: '2026-08-21T13:00:01Z' },
      ]),
    ).toBe(true)
    expect(allScoresConfirmed([])).toBe(false)
  })
})
