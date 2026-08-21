import { describe, expect, it } from 'vitest'
import { parseStakeToCents } from './money'

describe('parseStakeToCents', () => {
  it('accepte 0 €', () => {
    expect(parseStakeToCents('0')).toBe(0)
    expect(parseStakeToCents('0,00')).toBe(0)
  })

  it('refuse un champ vide', () => {
    expect(parseStakeToCents('')).toBe(null)
    expect(parseStakeToCents('   ')).toBe(null)
  })

  it('refuse au-delà de 50 €', () => {
    expect(parseStakeToCents('50,01')).toBe(null)
    expect(parseStakeToCents('-1')).toBe(null)
  })
})
