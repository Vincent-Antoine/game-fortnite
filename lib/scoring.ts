export type PlayerScore = {
  playerId: string
  kills: number
  revives: number
}

export type Transfer = {
  fromPlayerId: string
  toPlayerId: string
  amountCents: number
}

export type PowerKind = 'double' | 'shield' | 'halve'

export type PowerUse = {
  playerId: string
  kind: PowerKind
  targetPlayerId: string | null
}

type RankedPlayer = {
  playerId: string
  points: number
  hasFirstKill: boolean
  rankKey: string
}

export function pointsOf(score: PlayerScore): number {
  return score.kills + score.revives
}

export function modifiedPoints(scores: PlayerScore[], powers: PowerUse[] = []): Map<string, number> {
  const points = new Map(scores.map((score) => [score.playerId, pointsOf(score)]))
  for (const power of powers) {
    if (power.kind === 'double') {
      points.set(power.playerId, (points.get(power.playerId) ?? 0) * 2)
    }
  }
  for (const power of powers) {
    if (power.kind === 'halve' && power.targetPlayerId) {
      const current = points.get(power.targetPlayerId) ?? 0
      points.set(power.targetPlayerId, Math.floor(current / 2))
    }
  }
  return points
}

export function sessionPoints(
  games: { scores: PlayerScore[]; powers?: PowerUse[] }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const game of games) {
    const points = modifiedPoints(game.scores, game.powers ?? [])
    for (const [playerId, value] of points) {
      totals.set(playerId, (totals.get(playerId) ?? 0) + value)
    }
  }
  return totals
}

function rankKeyOf(row: RankedPlayer): string {
  return `${row.points}:${row.hasFirstKill ? '1' : '0'}`
}

export function settleGame(input: {
  scores: PlayerScore[]
  firstKillPlayerId: string | null
  stakeCents: number
  powers?: PowerUse[]
}): Transfer[] {
  const { scores, firstKillPlayerId, stakeCents, powers = [] } = input
  if (scores.length < 2) {
    return []
  }

  const points = modifiedPoints(scores, powers)
  const ranked: RankedPlayer[] = scores.map((score) => {
    const row = {
      playerId: score.playerId,
      points: points.get(score.playerId) ?? 0,
      hasFirstKill: firstKillPlayerId === score.playerId,
      rankKey: '',
    }
    row.rankKey = rankKeyOf(row)
    return row
  })

  ranked.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points
    }
    if (a.hasFirstKill !== b.hasFirstKill) {
      return a.hasFirstKill ? -1 : 1
    }
    return a.playerId.localeCompare(b.playerId)
  })

  const best = ranked[0]
  const worst = ranked[ranked.length - 1]
  const winners = ranked.filter((row) => row.rankKey === best.rankKey)
  let losers = ranked.filter((row) => row.rankKey === worst.rankKey)

  const shielded = new Set(
    powers.filter((power) => power.kind === 'shield').map((power) => power.playerId),
  )
  const shieldedLosers = losers.filter((row) => shielded.has(row.playerId))
  if (shieldedLosers.length > 0) {
    losers = losers.filter((row) => !shielded.has(row.playerId))
    if (losers.length === 0) {
      const remaining = ranked.filter(
        (row) => !winners.some((winner) => winner.playerId === row.playerId) && !shielded.has(row.playerId),
      )
      if (remaining.length === 0) {
        return []
      }
      const nextWorst = remaining[remaining.length - 1]
      losers = remaining.filter((row) => row.rankKey === nextWorst.rankKey)
    }
  }

  if (winners.some((row) => losers.some((loser) => loser.playerId === row.playerId))) {
    return []
  }

  const winnerPoints = winners[0].points
  const potCents = stakeCents * winnerPoints
  if (potCents <= 0) {
    return []
  }

  const loserIds = losers.map((row) => row.playerId).sort()
  const winnerIds = winners.map((row) => row.playerId).sort()
  const loserShares = splitCents(potCents, loserIds.length)
  const winnerShares = splitCents(potCents, winnerIds.length)

  const remainingPay = loserIds.map((playerId, index) => ({
    playerId,
    remaining: loserShares[index],
  }))
  const remainingReceive = winnerIds.map((playerId, index) => ({
    playerId,
    remaining: winnerShares[index],
  }))

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < remainingPay.length && j < remainingReceive.length) {
    const pay = remainingPay[i]
    const receive = remainingReceive[j]
    const amount = Math.min(pay.remaining, receive.remaining)
    if (amount > 0) {
      transfers.push({
        fromPlayerId: pay.playerId,
        toPlayerId: receive.playerId,
        amountCents: amount,
      })
      pay.remaining -= amount
      receive.remaining -= amount
    }
    if (pay.remaining === 0) {
      i += 1
    }
    if (receive.remaining === 0) {
      j += 1
    }
  }

  return transfers
}

export function netBalances(transfers: Transfer[]): Record<string, number> {
  const net: Record<string, number> = {}
  for (const transfer of transfers) {
    net[transfer.fromPlayerId] = (net[transfer.fromPlayerId] ?? 0) - transfer.amountCents
    net[transfer.toPlayerId] = (net[transfer.toPlayerId] ?? 0) + transfer.amountCents
  }
  return net
}

export function simplifyDebts(net: Record<string, number>): Transfer[] {
  const debtors = Object.entries(net)
    .filter(([, amount]) => amount < 0)
    .map(([playerId, amount]) => ({ playerId, remaining: -amount }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
  const creditors = Object.entries(net)
    .filter(([, amount]) => amount > 0)
    .map(([playerId, amount]) => ({ playerId, remaining: amount }))
    .sort((a, b) => a.playerId.localeCompare(b.playerId))

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.remaining, creditor.remaining)
    if (amount > 0) {
      transfers.push({
        fromPlayerId: debtor.playerId,
        toPlayerId: creditor.playerId,
        amountCents: amount,
      })
      debtor.remaining -= amount
      creditor.remaining -= amount
    }
    if (debtor.remaining === 0) {
      i += 1
    }
    if (creditor.remaining === 0) {
      j += 1
    }
  }
  return transfers
}

function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const remainder = total - base * parts
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0))
}
