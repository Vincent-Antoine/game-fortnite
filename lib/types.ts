import type { Transfer } from '@/lib/scoring'

export type SessionDTO = {
  code: string
  status: 'open' | 'closed'
  stakeCents: number
  youPlayerId: string | null
  players: {
    id: string
    name: string
    avatar: string
    isHost: boolean
    color: string
  }[]
  games: {
    id: string
    index: number
    status: 'open' | 'closed'
    firstKillPlayerId: string | null
    scores: { playerId: string; kills: number; revives: number }[]
    transfers: Transfer[]
  }[]
  ticket: Transfer[]
}
