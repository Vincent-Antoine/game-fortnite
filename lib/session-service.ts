import { createHash, randomBytes } from 'node:crypto'
import { and, asc, eq } from 'drizzle-orm'
import { colorForIndex } from '@/lib/colors'
import { normalizeCode, randomCode } from '@/lib/code'
import { getDb } from '@/lib/db'
import { games, players, scores, sessions, transfers } from '@/lib/db/schema'
import { settleGame, simplifyDebts, netBalances, type Transfer } from '@/lib/scoring'
import type { SessionDTO } from '@/lib/types'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

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
  stakeCents?: number
}): Promise<{ dto: SessionDTO; playerId: string; token: string }> {
  const db = getDb()
  const name = sanitizeName(input.name)
  const stakeCents = input.stakeCents ?? 25
  if (!Number.isInteger(stakeCents) || stakeCents < 1 || stakeCents > 5000) {
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
      name,
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
}): Promise<{ dto: SessionDTO; playerId: string; token: string }> {
  const db = getDb()
  const code = normalizeCode(input.code)
  const name = sanitizeName(input.name)
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

  if (duplicate) {
    if (duplicate.tokenHash) {
      throw new ApiError(409, 'Ce pseudo est déjà pris')
    }
    await db
      .update(players)
      .set({ tokenHash: hashToken(token) })
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
      name,
      isHost: false,
      color: colorForIndex(existingPlayers.length),
      tokenHash: hashToken(token),
    })
    .returning()

  await ensureScoreForOpenGame(session.id, player.id)
  const dto = await getSessionDto(session.code, player.id)
  return { dto, playerId: player.id, token }
}

export async function addPlayer(input: { code: string; name: string }): Promise<SessionDTO> {
  const db = getDb()
  const code = normalizeCode(input.code)
  const name = sanitizeName(input.name)
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
  firstKillPlayerId: string | null
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

  if (input.firstKillPlayerId && !rosterIds.has(input.firstKillPlayerId)) {
    throw new ApiError(400, 'First kill invalide')
  }

  await db
    .update(games)
    .set({ firstKillPlayerId: input.firstKillPlayerId })
    .where(eq(games.id, game.id))

  for (const row of input.scores) {
    if (!rosterIds.has(row.playerId)) {
      throw new ApiError(400, 'Joueur inconnu')
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
  const settled = settleGame({
    scores: rows.map((row) => ({
      playerId: row.playerId,
      kills: row.kills,
      revives: row.revives,
    })),
    firstKillPlayerId: game.firstKillPlayerId,
    stakeCents: session.stakeCents,
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
      firstKillPlayerId: game.firstKillPlayerId,
      scores: gameScores.map((row) => ({
        playerId: row.playerId,
        kills: row.kills,
        revives: row.revives,
      })),
      transfers: mappedTransfers,
    })
  }

  return {
    code: session.code,
    status: session.status as 'open' | 'closed',
    stakeCents: session.stakeCents,
    youPlayerId,
    players: roster.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      color: player.color,
    })),
    games: gameDtos,
    ticket: simplifyDebts(netBalances(closedTransfers)),
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
