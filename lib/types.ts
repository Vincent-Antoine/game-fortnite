import type { PowerUse, Transfer } from '@/lib/scoring'

export type SessionDTO = {
  code: string
  status: 'open' | 'closed'
  stakeCents: number
  youPlayerId: string | null
  players: {
    id: string
    name: string
    avatar: string
    photoData: string | null
    isHost: boolean
    color: string
    lastSeenAt: string | null
    usedPowers: { double: boolean; shield: boolean; halve: boolean }
  }[]
  games: {
    id: string
    index: number
    status: 'open' | 'closed'
    powersLocked: boolean
    firstKillPlayerId: string | null
    scores: { playerId: string; kills: number; revives: number; confirmedAt: string | null }[]
    powers: PowerUse[]
    transfers: Transfer[]
  }[]
  ticket: Transfer[]
  pings: { id: string; fromPlayerId: string; body: string; createdAt: string }[]
}
