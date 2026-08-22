import { createHash, randomBytes } from 'node:crypto'
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { colorForIndex } from '@/lib/colors'
import { sanitizeAvatar } from '@/lib/avatars'
import { allScoresConfirmed, pingTooSoon, resolveSessionPing } from '@/lib/chat'
import { normalizeCode, randomCode } from '@/lib/code'
import { getDb } from '@/lib/db'
import { gamePowers, games, players, scores, sessionPings, sessions, transfers } from '@/lib/db/schema'
import { ApiError } from '@/lib/errors'
import { notifyUser } from '@/lib/notify'
import { sanitizePhoto } from '@/lib/photo'
import { settleGame, simplifyDebts, netBalances, type PowerKind, type PowerUse, type Transfer } from '@/lib/scoring'
import type { SessionDTO } from '@/lib/types'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function sanitizeName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 1 || cleaned.length > 20) {
    throw new ApiError(400, 'Pseudo entre 1 et 20 caractères')
  }
  return cleaned
}

function clampStat(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0 || n > 99) {
    throw new ApiError(400, 'Kills et réas entre 0 et 99')
  }
  return n
}

async function uniqueCode(): Promise<string> {
  const db = getDb()
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode(4)
    const existing = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.code, code))
      .limit(1)
    if (existing.length === 0) {
      return code
    }
  }
  throw new ApiError(500, 'Impossible de créer un code')
}

export async function createSession(input: {
  name: string
  avatar?: string
  photoData?: string | null
  stakeCents?: number
  userId?: string | null
}): Promise<{ dto: SessionDTO; playerId: string; token: string }> {
  const db = getDb()
  const name = sanitizeName(input.name)
  const avatar = sanitizeAvatar(input.avatar)
  const photoData = sanitizePhoto(input.photoData)
  const stakeCents = input.stakeCents ?? 25
  if (!Number.isInteger(stakeCents) || stakeCents < 0 || stakeCents > 5000) {
    throw new ApiError(400, 'Mise invalide')
  }

  const code = await uniqueCode()
  const token = randomBytes(24).toString('hex')

  const [session] = await db
    .insert(sessions)
    .values({ code, stakeCents, status: 'open' })
    .returning()

  const [player] = await db
    .insert(players)
    .values({
      sessionId: session.id,
      userId: input.userId ?? null,
      name,
      avatar,
      photoData,
      isHost: true,
      color: colorForIndex(0),
      tokenHash: hashToken(token),
    })
    .returning()

  const dto = await getSessionDto(code, player.id)
  return { dto, playerId: player.id, token }
}

export async function joinSession(input: {
  code: string
  name: string
  avatar?: string
  photoData?: string | null
  userId?: string | null
}): Promise<{ dto: SessionDTO; playerId: string; token: string }> {
  const db = getDb()
  const code = normalizeCode(input.code)
  const name = sanitizeName(input.name)
  const avatar = sanitizeAvatar(input.avatar)
  const photoData = sanitizePhoto(input.photoData)
  const session = await requireSession(code)
  if (session.status === 'closed') {
    throw new ApiError(409, 'Session clôturée')
  }

  const existingPlayers = await db
    .select()
    .from(players)
    .where(eq(players.sessionId, session.id))
    .orderBy(asc(players.createdAt))

  const duplicate = existingPlayers.find(
    (player) => player.name.toLowerCase() === name.toLowerCase(),
  )
  const token = randomBytes(24).toString('hex')

  if (input.userId) {
    const mine = existingPlayers.find((player) => player.userId === input.userId)
    if (mine) {
      await db
        .update(players)
        .set({ tokenHash: hashToken(token), avatar, photoData: photoData ?? mine.photoData })
        .where(eq(players.id, mine.id))
      const dto = await getSessionDto(session.code, mine.id)
      return { dto, playerId: mine.id, token }
    }
  }

  if (duplicate) {
    if (duplicate.tokenHash) {
      throw new ApiError(409, 'Ce pseudo est déjà pris')
    }
    await db
      .update(players)
      .set({
        tokenHash: hashToken(token),
        avatar,
        photoData: photoData ?? duplicate.photoData,
        userId: input.userId ?? duplicate.userId,
      })
      .where(eq(players.id, duplicate.id))
    const dto = await getSessionDto(session.code, duplicate.id)
    return { dto, playerId: duplicate.id, token }
  }

  if (existingPlayers.length >= 8) {
    throw new ApiError(409, 'Session complète (8 joueurs)')
  }

  const [player] = await db
    .insert(players)
    .values({
      sessionId: session.id,
      userId: input.userId ?? null,
      name,
      avatar,
      photoData,
      isHost: false,
      color: colorForIndex(existingPlayers.length),
      tokenHash: hashToken(token),
    })
    .returning()

  await ensureScoreForOpenGame(session.id, player.id)
  const dto = await getSessionDto(session.code, player.id)
  return { dto, playerId: player.id, token }
}

export async function addPlayer(input: {
  code: string
  name: string
  avatar?: string
  photoData?: string | null
}): Promise<SessionDTO> {
  const db = getDb()
  const code = normalizeCode(input.code)
  const name = sanitizeName(input.name)
  const avatar = sanitizeAvatar(input.avatar)
  const photoData = sanitizePhoto(input.photoData)
  const session = await requireOpenSession(code)
  const existingPlayers = await db
    .select()
    .from(players)
    .where(eq(players.sessionId, session.id))
    .orderBy(asc(players.createdAt))

  if (existingPlayers.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(409, 'Ce pseudo est déjà pris')
  }
  if (existingPlayers.length >= 8) {
    throw new ApiError(409, 'Session complète (8 joueurs)')
  }

  const [player] = await db
    .insert(players)
    .values({
      sessionId: session.id,
      name,
      avatar,
      photoData,
      isHost: false,
      color: colorForIndex(existingPlayers.length),
      tokenHash: null,
    })
    .returning()

  await ensureScoreForOpenGame(session.id, player.id)
  return getSessionDto(session.code, null)
}

export async function createGame(code: string): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.sessionId, session.id))
    .orderBy(asc(players.createdAt))

  if (roster.length < 2) {
    throw new ApiError(400, 'Il faut au moins 2 joueurs')
  }

  const open = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.sessionId, session.id), eq(games.status, 'open')))
    .limit(1)
  if (open.length > 0) {
    throw new ApiError(409, 'Une game est déjà en cours')
  }

  const [game] = await db.insert(games).values({ sessionId: session.id, status: 'open' }).returning()
  await db.insert(scores).values(
    roster.map((player) => ({
      gameId: game.id,
      playerId: player.id,
      kills: 0,
      revives: 0,
    })),
  )

  return getSessionDto(session.code, null)
}

export async function updateOpenGame(input: {
  code: string
  gameId: string
  firstKillPlayerId?: string | null
  scores: { playerId: string; kills: number; revives: number }[]
}): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(input.code)
  const game = await requireGame(session.id, input.gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }

  const roster = await db.select().from(players).where(eq(players.sessionId, session.id))
  const rosterIds = new Set(roster.map((player) => player.id))

  if (input.firstKillPlayerId !== undefined) {
    if (input.firstKillPlayerId && !rosterIds.has(input.firstKillPlayerId)) {
      throw new ApiError(400, 'First kill invalide')
    }
    await db
      .update(games)
      .set({ firstKillPlayerId: input.firstKillPlayerId })
      .where(eq(games.id, game.id))
  }

  for (const row of input.scores) {
    if (!rosterIds.has(row.playerId)) {
      throw new ApiError(400, 'Joueur inconnu')
    }
    const [current] = await db
      .select()
      .from(scores)
      .where(and(eq(scores.gameId, game.id), eq(scores.playerId, row.playerId)))
      .limit(1)
    if (current?.confirmedAt) {
      throw new ApiError(409, 'Score déjà confirmé')
    }
    await db
      .update(scores)
      .set({ kills: clampStat(row.kills), revives: clampStat(row.revives) })
      .where(and(eq(scores.gameId, game.id), eq(scores.playerId, row.playerId)))
  }

  return getSessionDto(session.code, null)
}

export async function closeGame(code: string, gameId: string): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const game = await requireGame(session.id, gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }

  const rows = await db.select().from(scores).where(eq(scores.gameId, game.id))
  const roster = await db.select({ id: players.id }).from(players).where(eq(players.sessionId, session.id))
  if (rows.length < roster.length || !allScoresConfirmed(rows)) {
    throw new ApiError(409, 'Tout le monde n’a pas confirmé')
  }
  const powerRows = await db.select().from(gamePowers).where(eq(gamePowers.gameId, game.id))
  const settled = settleGame({
    scores: rows.map((row) => ({
      playerId: row.playerId,
      kills: row.kills,
      revives: row.revives,
    })),
    firstKillPlayerId: game.firstKillPlayerId,
    stakeCents: session.stakeCents,
    powers: powerRows.map((row) => ({
      playerId: row.playerId,
      kind: row.kind as PowerKind,
      targetPlayerId: row.targetPlayerId,
    })),
  })

  if (settled.length > 0) {
    await db.insert(transfers).values(
      settled.map((row) => ({
        gameId: game.id,
        fromPlayerId: row.fromPlayerId,
        toPlayerId: row.toPlayerId,
        amountCents: row.amountCents,
      })),
    )
  }

  await db
    .update(games)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(games.id, game.id))

  return getSessionDto(session.code, null)
}

export async function closeSession(code: string): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const open = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.sessionId, session.id), eq(games.status, 'open')))
    .limit(1)
  if (open.length > 0) {
    throw new ApiError(409, 'Clôture d’abord la game en cours')
  }

  await db.update(sessions).set({ status: 'closed' }).where(eq(sessions.id, session.id))
  return getSessionDto(session.code, null)
}

export async function getSessionDto(
  code: string,
  youPlayerId: string | null,
): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireSession(code)
  const roster = await db
    .select()
    .from(players)
    .where(eq(players.sessionId, session.id))
    .orderBy(asc(players.createdAt))
  const sessionGames = await db
    .select()
    .from(games)
    .where(eq(games.sessionId, session.id))
    .orderBy(asc(games.createdAt))

  const gameDtos = []
  const closedTransfers: Transfer[] = []

  for (const [index, game] of sessionGames.entries()) {
    const gameScores = await db.select().from(scores).where(eq(scores.gameId, game.id))
    const gameTransfers = await db.select().from(transfers).where(eq(transfers.gameId, game.id))
    const powerRows = await db.select().from(gamePowers).where(eq(gamePowers.gameId, game.id))
    const mappedPowers: PowerUse[] = powerRows.map((row) => ({
      playerId: row.playerId,
      kind: row.kind as PowerKind,
      targetPlayerId: row.targetPlayerId,
    }))
    const mappedTransfers = gameTransfers.map((row) => ({
      fromPlayerId: row.fromPlayerId,
      toPlayerId: row.toPlayerId,
      amountCents: row.amountCents,
    }))
    if (game.status === 'closed') {
      closedTransfers.push(...mappedTransfers)
    }
    gameDtos.push({
      id: game.id,
      index: index + 1,
      status: game.status as 'open' | 'closed',
      powersLocked: game.powersLocked,
      firstKillPlayerId: game.firstKillPlayerId,
      scores: gameScores.map((row) => ({
        playerId: row.playerId,
        kills: row.kills,
        revives: row.revives,
        confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
      })),
      powers: mappedPowers,
      transfers: mappedTransfers,
    })
  }

  const usedByPlayer = new Map<string, { double: boolean; shield: boolean; halve: boolean }>()
  for (const game of gameDtos) {
    if (game.status === 'open') {
      continue
    }
    for (const power of game.powers) {
      const current = usedByPlayer.get(power.playerId) ?? { double: false, shield: false, halve: false }
      current[power.kind] = true
      usedByPlayer.set(power.playerId, current)
    }
  }

  const pingRows = await db
    .select()
    .from(sessionPings)
    .where(eq(sessionPings.sessionId, session.id))
    .orderBy(desc(sessionPings.createdAt))
    .limit(20)

  return {
    code: session.code,
    status: session.status as 'open' | 'closed',
    stakeCents: session.stakeCents,
    youPlayerId,
    players: roster.map((player) => ({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      photoData: player.photoData,
      isHost: player.isHost,
      color: player.color,
      lastSeenAt: player.lastSeenAt ? player.lastSeenAt.toISOString() : null,
      usedPowers: usedByPlayer.get(player.id) ?? { double: false, shield: false, halve: false },
    })),
    games: gameDtos,
    ticket: simplifyDebts(netBalances(closedTransfers)),
    pings: pingRows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        fromPlayerId: row.fromPlayerId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
  }
}

export async function identifyPlayer(
  code: string,
  playerId: string | undefined,
  token: string | undefined,
): Promise<string | null> {
  if (!playerId || !token) {
    return null
  }
  const db = getDb()
  const session = await requireSession(code)
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.sessionId, session.id)))
  if (!player?.tokenHash || player.tokenHash !== hashToken(token)) {
    return null
  }
  return player.id
}

export async function identifyPlayerByUser(code: string, userId: string): Promise<string | null> {
  const db = getDb()
  const session = await requireSession(code)
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.sessionId, session.id), eq(players.userId, userId)))
    .limit(1)
  return player?.id ?? null
}

async function requireSession(code: string) {
  const db = getDb()
  const normalized = normalizeCode(code)
  const [session] = await db.select().from(sessions).where(eq(sessions.code, normalized)).limit(1)
  if (!session) {
    throw new ApiError(404, 'Session introuvable')
  }
  return session
}

async function requireOpenSession(code: string) {
  const session = await requireSession(code)
  if (session.status === 'closed') {
    throw new ApiError(409, 'Session clôturée')
  }
  return session
}

async function requireGame(sessionId: string, gameId: string) {
  const db = getDb()
  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.sessionId, sessionId)))
    .limit(1)
  if (!game) {
    throw new ApiError(404, 'Game introuvable')
  }
  return game
}

async function ensureScoreForOpenGame(sessionId: string, playerId: string) {
  const db = getDb()
  const [open] = await db
    .select()
    .from(games)
    .where(and(eq(games.sessionId, sessionId), eq(games.status, 'open')))
    .limit(1)
  if (!open) {
    return
  }
  await db
    .insert(scores)
    .values({ gameId: open.id, playerId, kills: 0, revives: 0 })
    .onConflictDoNothing({ target: [scores.gameId, scores.playerId] })
}

export async function nudgeScore(input: {
  code: string
  gameId: string
  playerId: string
  killsDelta?: number
  revivesDelta?: number
}): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(input.code)
  const game = await requireGame(session.id, input.gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }
  const [current] = await db
    .select()
    .from(scores)
    .where(and(eq(scores.gameId, game.id), eq(scores.playerId, input.playerId)))
    .limit(1)
  if (current?.confirmedAt) {
    throw new ApiError(409, 'Score déjà confirmé')
  }
  const killsDelta = Number(input.killsDelta ?? 0)
  const revivesDelta = Number(input.revivesDelta ?? 0)
  if (!Number.isInteger(killsDelta) || !Number.isInteger(revivesDelta)) {
    throw new ApiError(400, 'Delta invalide')
  }
  if (Math.abs(killsDelta) + Math.abs(revivesDelta) === 0 || Math.abs(killsDelta) > 20 || Math.abs(revivesDelta) > 20) {
    throw new ApiError(400, 'Delta invalide')
  }
  await db.execute(sql`
    update scores
    set
      kills = greatest(0, least(99, kills + ${killsDelta})),
      revives = greatest(0, least(99, revives + ${revivesDelta}))
    where game_id = ${input.gameId}::uuid and player_id = ${input.playerId}::uuid
  `)
  return getSessionDto(session.code, null)
}

export async function setPlayerPhoto(input: {
  code: string
  playerId: string
  photoData: string | null
}): Promise<SessionDTO> {
  const session = await requireOpenSession(input.code)
  const photoData = sanitizePhoto(input.photoData)
  const db = getDb()
  await db.update(players).set({ photoData }).where(eq(players.id, input.playerId))
  return getSessionDto(session.code, null)
}

export async function togglePower(input: {
  code: string
  gameId: string
  playerId: string
  kind: PowerKind
  targetPlayerId: string | null
}): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(input.code)
  const game = await requireGame(session.id, input.gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }
  if (game.powersLocked) {
    throw new ApiError(409, 'Les pouvoirs sont verrouillés')
  }
  if (!['double', 'shield', 'halve'].includes(input.kind)) {
    throw new ApiError(400, 'Pouvoir inconnu')
  }
  if (input.kind === 'halve' && !input.targetPlayerId) {
    throw new ApiError(400, 'Choisis une cible')
  }
  const [you] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, input.playerId), eq(players.sessionId, session.id)))
    .limit(1)
  if (!you) {
    throw new ApiError(403, 'Pas dans la session')
  }

  const otherGames = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.sessionId, session.id), eq(games.status, 'closed')))
  for (const row of otherGames) {
    const used = await db
      .select()
      .from(gamePowers)
      .where(and(eq(gamePowers.gameId, row.id), eq(gamePowers.playerId, input.playerId), eq(gamePowers.kind, input.kind)))
    if (used.length > 0) {
      throw new ApiError(409, 'Déjà utilisé dans cette session')
    }
  }

  const current = await db
    .select()
    .from(gamePowers)
    .where(and(eq(gamePowers.gameId, game.id), eq(gamePowers.playerId, input.playerId)))

  const same = current.find((row) => {
    if (row.kind !== input.kind) {
      return false
    }
    if (input.kind === 'halve') {
      return row.targetPlayerId === input.targetPlayerId
    }
    return true
  })
  if (current.length > 0) {
    await db.delete(gamePowers).where(and(eq(gamePowers.gameId, game.id), eq(gamePowers.playerId, input.playerId)))
  }
  if (same) {
    return getSessionDto(session.code, input.playerId)
  }
  await db.insert(gamePowers).values({
    gameId: game.id,
    playerId: input.playerId,
    kind: input.kind,
    targetPlayerId: input.kind === 'halve' ? input.targetPlayerId : null,
  })
  return getSessionDto(session.code, input.playerId)
}

export async function lockGamePowers(code: string, gameId: string): Promise<SessionDTO> {
  const session = await requireOpenSession(code)
  const game = await requireGame(session.id, gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }
  const db = getDb()
  await db.update(games).set({ powersLocked: true }).where(eq(games.id, game.id))
  return getSessionDto(session.code, null)
}

export async function touchPresence(code: string, playerId?: string, token?: string): Promise<SessionDTO> {
  const you = await identifyPlayer(code, playerId, token)
  if (!you) {
    throw new ApiError(401, 'Rejoins la session d’abord')
  }
  const db = getDb()
  await db.update(players).set({ lastSeenAt: new Date() }).where(eq(players.id, you))
  return getSessionDto(code, you)
}

export async function confirmOwnScore(code: string, gameId: string, playerId: string): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const game = await requireGame(session.id, gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }
  const [row] = await db
    .select()
    .from(scores)
    .where(and(eq(scores.gameId, game.id), eq(scores.playerId, playerId)))
    .limit(1)
  if (!row) {
    throw new ApiError(404, 'Score introuvable')
  }
  if (row.confirmedAt) {
    throw new ApiError(409, 'Score déjà confirmé')
  }
  await db.update(scores).set({ confirmedAt: new Date() }).where(eq(scores.id, row.id))
  const roster = await db.select().from(players).where(eq(players.sessionId, session.id))
  const you = roster.find((player) => player.id === playerId)
  const host = roster.find((player) => player.isHost)
  const remaining = await db.select().from(scores).where(eq(scores.gameId, game.id))
  if (host?.userId && host.id !== playerId && you) {
    await notifyUser(host.userId, {
      type: 'confirm',
      title: `${you.name} a confirmé`,
      href: `/session/${session.code}`,
      body: allScoresConfirmed(remaining) ? 'Tout le monde a validé. Tu peux clôturer.' : 'Il reste des scores à valider.',
    })
  }
  return getSessionDto(session.code, playerId)
}

export async function unconfirmOwnScore(code: string, gameId: string, playerId: string): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const game = await requireGame(session.id, gameId)
  if (game.status !== 'open') {
    throw new ApiError(409, 'Game déjà clôturée')
  }
  const [row] = await db
    .select()
    .from(scores)
    .where(and(eq(scores.gameId, game.id), eq(scores.playerId, playerId)))
    .limit(1)
  if (!row) {
    throw new ApiError(404, 'Score introuvable')
  }
  if (!row.confirmedAt) {
    throw new ApiError(409, 'Score pas encore confirmé')
  }
  await db.update(scores).set({ confirmedAt: null }).where(eq(scores.id, row.id))
  const roster = await db.select().from(players).where(eq(players.sessionId, session.id))
  const you = roster.find((player) => player.id === playerId)
  const host = roster.find((player) => player.isHost)
  if (host?.userId && host.id !== playerId && you) {
    await notifyUser(host.userId, {
      type: 'confirm',
      title: `${you.name} modifie ses scores`,
      href: `/session/${session.code}`,
      body: 'La clôture est de nouveau bloquée.',
    })
  }
  return getSessionDto(session.code, playerId)
}

export async function sendSessionPing(
  code: string,
  playerId: string,
  input: { preset?: string; body?: string },
): Promise<SessionDTO> {
  const db = getDb()
  const session = await requireOpenSession(code)
  const roster = await db.select().from(players).where(eq(players.sessionId, session.id))
  if (!roster.some((player) => player.id === playerId)) {
    throw new ApiError(403, 'Pas dans la session')
  }
  const [last] = await db
    .select()
    .from(sessionPings)
    .where(and(eq(sessionPings.sessionId, session.id), eq(sessionPings.fromPlayerId, playerId)))
    .orderBy(desc(sessionPings.createdAt))
    .limit(1)
  if (pingTooSoon(last?.createdAt ?? null)) {
    throw new ApiError(429, 'Attends 10 secondes')
  }
  const body = resolveSessionPing(input)
  await db.insert(sessionPings).values({
    sessionId: session.id,
    fromPlayerId: playerId,
    body,
  })
  const you = roster.find((player) => player.id === playerId)
  const seen = new Set<string>()
  await Promise.all(
    roster.map(async (player) => {
      if (!player.userId || player.id === playerId || seen.has(player.userId)) {
        return
      }
      seen.add(player.userId)
      await notifyUser(player.userId, {
        type: 'ping',
        title: `${you?.name ?? 'Un pote'} · ${session.code}`,
        href: `/session/${session.code}`,
        body,
      })
    }),
  )
  return getSessionDto(session.code, playerId)
}

async function requireHost(code: string, hostPlayerId: string) {
  const db = getDb()
  const session = await requireOpenSession(code)
  const [host] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, hostPlayerId), eq(players.sessionId, session.id)))
    .limit(1)
  if (!host?.isHost) {
    throw new ApiError(403, 'Seul l’hôte peut faire ça')
  }
  return { db, session, host }
}

export async function renamePlayer(
  code: string,
  hostPlayerId: string,
  playerId: string,
  name: string,
): Promise<SessionDTO> {
  const { db, session } = await requireHost(code, hostPlayerId)
  const cleaned = sanitizeName(name)
  const roster = await db.select().from(players).where(eq(players.sessionId, session.id))
  const target = roster.find((player) => player.id === playerId)
  if (!target) {
    throw new ApiError(404, 'Joueur introuvable')
  }
  if (roster.some((player) => player.id !== playerId && player.name.toLowerCase() === cleaned.toLowerCase())) {
    throw new ApiError(409, 'Ce pseudo est déjà pris')
  }
  await db.update(players).set({ name: cleaned }).where(eq(players.id, playerId))
  return getSessionDto(session.code, hostPlayerId)
}

export async function kickPlayer(code: string, hostPlayerId: string, playerId: string): Promise<SessionDTO> {
  const { db, session } = await requireHost(code, hostPlayerId)
  if (playerId === hostPlayerId) {
    throw new ApiError(400, 'Tu ne peux pas te retirer')
  }
  const [target] = await db
    .select()
    .from(players)
    .where(and(eq(players.id, playerId), eq(players.sessionId, session.id)))
    .limit(1)
  if (!target) {
    throw new ApiError(404, 'Joueur introuvable')
  }
  if (target.isHost) {
    throw new ApiError(403, 'Impossible de retirer l’hôte')
  }
  const closed = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.sessionId, session.id), eq(games.status, 'closed')))
  if (closed.length > 0) {
    const closedIds = closed.map((row) => row.id)
    const played = await db
      .select({ id: scores.id })
      .from(scores)
      .where(and(eq(scores.playerId, playerId), inArray(scores.gameId, closedIds)))
      .limit(1)
    if (played.length > 0) {
      throw new ApiError(409, 'Déjà dans une game clôturée. Tu peux juste renommer.')
    }
  }
  await db.update(games).set({ firstKillPlayerId: null }).where(eq(games.firstKillPlayerId, playerId))
  await db.delete(gamePowers).where(or(eq(gamePowers.playerId, playerId), eq(gamePowers.targetPlayerId, playerId)))
  await db.delete(scores).where(eq(scores.playerId, playerId))
  await db.delete(players).where(eq(players.id, playerId))
  return getSessionDto(session.code, hostPlayerId)
}
