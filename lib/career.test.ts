import { describe, expect, it } from 'vitest'
import { emptyCareer, sortCareers } from './career'

describe('sortCareers', () => {
  const brandon = { ...emptyCareer({ id: '1', name: 'Brandon', friendCode: 'AAAAAA' }), points: 12, kills: 8 }
  const dany = { ...emptyCareer({ id: '2', name: 'Dany', friendCode: 'BBBBBB' }), points: 12, kills: 10 }
  const vince = { ...emptyCareer({ id: '3', name: 'Vince', friendCode: 'CCCCCC' }), points: 20, kills: 4 }

  it('classe d’abord par la métrique choisie', () => {
    const rows = sortCareers([brandon, dany, vince], 'points')
    expect(rows.map((row) => row.name)).toEqual(['Vince', 'Brandon', 'Dany'])
  })

  it('départage à nom égal de score', () => {
    const rows = sortCareers([dany, brandon, vince], 'points')
    expect(rows.map((row) => row.name)).toEqual(['Vince', 'Brandon', 'Dany'])
  })

  it('peut classer par kills', () => {
    const rows = sortCareers([brandon, dany, vince], 'kills')
    expect(rows.map((row) => row.name)).toEqual(['Dany', 'Brandon', 'Vince'])
  })
})
