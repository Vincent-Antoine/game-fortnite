import { describe, expect, it } from 'vitest'
import { emptyCareer, personalRecords, sortCareers } from './career'

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

describe('personalRecords', () => {
  it('prend le plus gros score de game, la série de wins et la pire soirée', () => {
    const records = personalRecords([
      { gameId: 'g1', sessionId: 's1', closedAt: 1, points: 4, won: true, lostCents: 0 },
      { gameId: 'g2', sessionId: 's1', closedAt: 2, points: 9, won: true, lostCents: 50 },
      { gameId: 'g3', sessionId: 's1', closedAt: 3, points: 2, won: false, lostCents: 200 },
      { gameId: 'g4', sessionId: 's2', closedAt: 4, points: 3, won: true, lostCents: 0 },
    ])
    expect(records.bestGame).toBe(9)
    expect(records.winStreak).toBe(2)
    expect(records.worstNightCents).toBe(250)
  })

  it('casse la série sur une game perdue', () => {
    const records = personalRecords([
      { gameId: 'g1', sessionId: 's1', closedAt: 1, points: 1, won: true, lostCents: 0 },
      { gameId: 'g2', sessionId: 's1', closedAt: 2, points: 1, won: false, lostCents: 100 },
      { gameId: 'g3', sessionId: 's1', closedAt: 3, points: 1, won: true, lostCents: 0 },
      { gameId: 'g4', sessionId: 's1', closedAt: 4, points: 1, won: true, lostCents: 0 },
      { gameId: 'g5', sessionId: 's1', closedAt: 5, points: 1, won: true, lostCents: 0 },
    ])
    expect(records.winStreak).toBe(3)
  })
})
