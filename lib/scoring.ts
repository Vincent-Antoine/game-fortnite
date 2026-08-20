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

type RankedPlayer = {
  playerId: string
  points: number
  hasFirstKill: boolean
}

export function pointsOf(score: PlayerScore): number {
  return score.kills + score.revives
}

export function settleGame(input: {
  scores: PlayerScore[]
  firstKillPlayerId: string | null
  stakeCents: number
}): Transfer[] {
  const { scores, firstKillPlayerId, stakeCents } = input
  if (scores.length < 2) {
    return []
  }

  const ranked: RankedPlayer[] = scores.map((score) => ({
    playerId: score.playerId,
    points: pointsOf(score),
    hasFirstKill: firstKillPlayerId === score.playerId,
  }))

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
  const winners = ranked.filter(
    (row) => row.points === best.points && row.hasFirstKill === best.hasFirstKill,
  )
  const losers = ranked.filter(
    (row) =>
      row.points === worst.points && row.hasFirstKill === worst.hasFirstKill,
  )

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
