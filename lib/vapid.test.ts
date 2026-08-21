import { describe, expect, it } from 'vitest'
import { vapidToBytes } from './vapid'

describe('vapidToBytes', () => {
  it('décode une clé url-safe', () => {
    const bytes = vapidToBytes('AQID')
    expect(Array.from(bytes)).toEqual([1, 2, 3])
  })
})
