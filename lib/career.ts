import { formatCents } from './money'
import { modifiedPoints, type PlayerScore, type PowerUse } from './scoring'

export function careerGamePoints(
  scores: PlayerScore[],
  powers: PowerUse[],
  playerIds: Set<string>,
): Record<string, number> {
  const modified = modifiedPoints(scores, powers)
  const result: Record<string, number> = {}
  for (const playerId of playerIds) {
    result[playerId] = modified.get(playerId) ?? 0
  }
  return result
}

export type Career = {
  userId: string
  name: string
  friendCode: string
  games: number
  sessions: number
  kills: number
  revives: number
  points: number
  firstKills: number
  wonCents: number
  lostCents: number
  netCents: number
  bestGame: number
  winStreak: number
  worstNightCents: number
}

export type CareerSort = 'points' | 'kills' | 'revives' | 'firstKills' | 'netCents' | 'games'

export type GameRecord = {
  gameId: string
  sessionId: string
  closedAt: number
  points: number
  won: boolean
  lostCents: number
}

export function emptyCareer(user: { id: string; name: string; friendCode: string }): Career {
  return {
    userId: user.id,
    name: user.name,
    friendCode: user.friendCode,
    games: 0,
    sessions: 0,
    kills: 0,
    revives: 0,
    points: 0,
    firstKills: 0,
    wonCents: 0,
    lostCents: 0,
    netCents: 0,
    bestGame: 0,
    winStreak: 0,
    worstNightCents: 0,
  }
}

export function sortCareers<T extends Career>(rows: T[], key: CareerSort): T[] {
  return [...rows].sort((a, b) => {
    const diff = b[key] - a[key]
    if (diff !== 0) {
      return diff
    }
    return a.name.localeCompare(b.name, 'fr')
  })
}

export function withMoneyLabels(career: Career) {
  return {
    ...career,
    wonLabel: formatCents(career.wonCents),
    lostLabel: formatCents(career.lostCents),
    netLabel: formatCents(career.netCents),
    worstNightLabel: formatCents(career.worstNightCents),
  }
}

export function personalRecords(games: GameRecord[]): {
  bestGame: number
  winStreak: number
  worstNightCents: number
} {
  const ordered = [...games].sort((a, b) => a.closedAt - b.closedAt)
  let bestGame = 0
  let winStreak = 0
  let current = 0
  const nightLost = new Map<string, number>()
  for (const game of ordered) {
    bestGame = Math.max(bestGame, game.points)
    if (game.won) {
      current += 1
      winStreak = Math.max(winStreak, current)
    } else {
      current = 0
    }
    nightLost.set(game.sessionId, (nightLost.get(game.sessionId) ?? 0) + game.lostCents)
  }
  return {
    bestGame,
    winStreak,
    worstNightCents: Math.max(0, ...nightLost.values(), 0),
  }
}
