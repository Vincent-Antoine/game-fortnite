import { describe, expect, it } from 'vitest'
import { sanitizePhoto } from './photo'

describe('sanitizePhoto', () => {
  it('accepte une data URL image', () => {
    expect(sanitizePhoto('data:image/jpeg;base64,abc')).toBe('data:image/jpeg;base64,abc')
  })

  it('vide si rien', () => {
    expect(sanitizePhoto(null)).toBe(null)
    expect(sanitizePhoto('')).toBe(null)
  })

  it('refuse un fichier trop lourd ou invalide', () => {
    expect(() => sanitizePhoto('http://x')).toThrow('Photo trop lourde')
    expect(() => sanitizePhoto(`data:image/jpeg;base64,${'a'.repeat(180001)}`)).toThrow('Photo trop lourde')
  })
})
