import { describe, expect, it } from 'vitest'
import { mergeSessionDto } from './session-sync'
import type { SessionDTO } from './types'

function session(openScores: { playerId: string; kills: number; revives: number }[], firstKillPlayerId: string | null = null): SessionDTO {
  return {
    code: 'T4DZ',
    status: 'open',
    stakeCents: 0,
    youPlayerId: 'b',
    players: [],
    games: [
      {
        id: 'g1',
        index: 1,
        status: 'open',
        powersLocked: true,
        firstKillPlayerId,
        scores: openScores.map((row) => ({ ...row, confirmedAt: null })),
        powers: [],
        transfers: [],
      },
    ],
    ticket: [],
    pings: [],
  }
}

describe('mergeSessionDto', () => {
  it('garde le score local d’un joueur en cours d’édition', () => {
    const local = session([
      { playerId: 'b', kills: 7, revives: 1 },
      { playerId: 'd', kills: 2, revives: 0 },
    ])
    const remote = session([
      { playerId: 'b', kills: 1, revives: 0 },
      { playerId: 'd', kills: 4, revives: 0 },
    ], 'd')
    const merged = mergeSessionDto(local, remote, ['b'])
    const open = merged.games[0]
    expect(open.scores.find((row) => row.playerId === 'b')).toMatchObject({ kills: 7, revives: 1 })
    expect(open.scores.find((row) => row.playerId === 'd')).toMatchObject({ kills: 4, revives: 0 })
    expect(open.firstKillPlayerId).toBe('d')
  })
})
