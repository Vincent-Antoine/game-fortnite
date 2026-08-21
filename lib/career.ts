import { formatCents } from './money'

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
}

export type CareerSort = 'points' | 'kills' | 'revives' | 'firstKills' | 'netCents' | 'games'

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
  }
}
