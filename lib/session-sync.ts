import type { SessionDTO } from './types'

export function mergeSessionDto(
  local: SessionDTO | null,
  remote: SessionDTO,
  heldPlayerIds: Iterable<string>,
): SessionDTO {
  if (!local) {
    return remote
  }
  const held = new Set(heldPlayerIds)
  if (held.size === 0) {
    return remote
  }
  const localOpen = local.games.find((game) => game.status === 'open')
  const remoteOpen = remote.games.find((game) => game.status === 'open')
  if (!localOpen || !remoteOpen || localOpen.id !== remoteOpen.id) {
    return remote
  }
  return {
    ...remote,
    games: remote.games.map((game) => {
      if (game.id !== remoteOpen.id) {
        return game
      }
      return {
        ...game,
        scores: game.scores.map((row) =>
          held.has(row.playerId)
            ? (localOpen.scores.find((score) => score.playerId === row.playerId) ?? row)
            : row,
        ),
      }
    }),
  }
}
