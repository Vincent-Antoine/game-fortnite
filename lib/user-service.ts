import { and, desc, eq, inArray, or, count } from 'drizzle-orm'
import { ApiError } from '@/lib/errors'
import { getAuthUser, hashToken, newToken, setUserCookie } from '@/lib/auth'
import { normalizeCode, randomCode } from '@/lib/code'
import { getDb } from '@/lib/db'
import {
  friendships,
  gamePowers,
  games,
  notifications,
  players,
  sessionInvites,
  sessions,
  scores,
  transfers,
  userSessions,
  users,
  directMessages,
} from '@/lib/db/schema'
import { sanitizeMessage } from '@/lib/chat'
import { sanitizePhoto } from '@/lib/photo'
import { emptyCareer, personalRecords, sortCareers, withMoneyLabels, type Career, type GameRecord } from '@/lib/career'
import { notifyUser } from '@/lib/notify'
import { seasonWindow, type SeasonRange } from '@/lib/season'
import { hashPassword, verifyPassword } from '@/lib/password'

function sanitizeUserName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 1 || cleaned.length > 20) {
    throw new ApiError(400, 'Pseudo entre 1 et 20 caractères')
  }
  return cleaned
}

function sanitizeEmail(email: string): string {
  const cleaned = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new ApiError(400, 'Email invalide')
  }
  return cleaned
}

async function uniqueFriendCode(): Promise<string> {
  const db = getDb()
  for (let i = 0; i < 12; i += 1) {
    const code = randomCode(6)
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.friendCode, code)).limit(1)
    if (!existing) {
      return code
    }
  }
  throw new ApiError(500, 'Impossible de créer un ID')
}

export async function registerUser(input: { name: string; email: string; password: string }) {
  const db = getDb()
  const name = sanitizeUserName(input.name)
  const email = sanitizeEmail(input.email)
  if (input.password.length < 6) {
    throw new ApiError(400, 'Mot de passe 6 caractères minimum')
  }
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (exists) {
    throw new ApiError(409, 'Cet email a déjà un compte')
  }
  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash: await hashPassword(input.password),
      friendCode: await uniqueFriendCode(),
    })
    .returning()
  await createLogin(user.id)
  return publicUser(user)
}

export async function loginUser(input: { email: string; password: string }) {
  const db = getDb()
  const email = sanitizeEmail(input.email)
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(401, 'Email ou mot de passe incorrect')
  }
  await createLogin(user.id)
  return publicUser(user)
}

async function createLogin(userId: string) {
  const token = newToken()
  const db = getDb()
  const [row] = await db
    .insert(userSessions)
    .values({ userId, tokenHash: hashToken(token) })
    .returning()
  await setUserCookie(row.id, token)
}

function publicUser(user: { id: string; email: string; name: string; friendCode: string; photoData?: string | null }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    friendCode: user.friendCode,
    photoData: user.photoData ?? null,
  }
}

export async function requireUser() {
  const user = await getAuthUser()
  if (!user) {
    throw new ApiError(401, 'Connecte-toi')
  }
  return user
}

export async function addFriendByCode(code: string) {
  const me = await requireUser()
  const db = getDb()
  const friendCode = code.trim().toUpperCase()
  const [target] = await db.select().from(users).where(eq(users.friendCode, friendCode)).limit(1)
  if (!target) {
    throw new ApiError(404, 'ID introuvable')
  }
  if (target.id === me.id) {
    throw new ApiError(400, 'Tu ne peux pas t’ajouter toi-même')
  }
  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, target.id)),
        and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, me.id)),
      ),
    )
  if (existing.some((row) => row.status === 'accepted')) {
    throw new ApiError(409, 'Déjà ami')
  }
  if (existing.some((row) => row.status === 'pending')) {
    throw new ApiError(409, 'Demande déjà envoyée')
  }
  await db.insert(friendships).values({ requesterId: me.id, addresseeId: target.id, status: 'pending' })
  await notifyUser(target.id, {
    type: 'friend',
    title: `${me.name} veut t’ajouter`,
    href: '/amis',
    body: 'Ouvre Amis pour accepter.',
  })
  return listFriends()
}

export async function acceptFriend(friendshipId: string) {
  const me = await requireUser()
  const db = getDb()
  const [row] = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1)
  if (!row || row.addresseeId !== me.id) {
    throw new ApiError(404, 'Demande introuvable')
  }
  await db.update(friendships).set({ status: 'accepted' }).where(eq(friendships.id, row.id))
  await notifyUser(row.requesterId, {
    type: 'friend',
    title: `${me.name} a accepté`,
    href: '/amis',
    body: 'Vous êtes amis. Comparez vos stats.',
  })
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, me.id), eq(notifications.type, 'friend'), eq(notifications.href, '/amis')))
  return listFriends()
}

export async function removeFriend(friendshipId: string) {
  const me = await requireUser()
  const db = getDb()
  const [row] = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1)
  if (!row || (row.requesterId !== me.id && row.addresseeId !== me.id)) {
    throw new ApiError(404, 'Ami introuvable')
  }
  await db.delete(friendships).where(eq(friendships.id, row.id))
  return { ok: true }
}

export async function listFriends() {
  const me = await requireUser()
  const db = getDb()
  const rows = await db.select().from(friendships).where(
    or(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, me.id)),
  )
  const unreadRows = await db
    .select({ fromUserId: directMessages.fromUserId, n: count() })
    .from(directMessages)
    .where(and(eq(directMessages.toUserId, me.id), eq(directMessages.read, false)))
    .groupBy(directMessages.fromUserId)
  const unread = new Map(unreadRows.map((row) => [row.fromUserId, Number(row.n)]))
  const result = []
  for (const row of rows) {
    const otherId = row.requesterId === me.id ? row.addresseeId : row.requesterId
    const [other] = await db.select().from(users).where(eq(users.id, otherId)).limit(1)
    if (!other) {
      continue
    }
    result.push({
      friendshipId: row.id,
      status: row.status,
      incoming: row.addresseeId === me.id && row.status === 'pending',
      unreadCount: unread.get(other.id) ?? 0,
      user: { id: other.id, name: other.name, friendCode: other.friendCode, photoData: other.photoData },
    })
  }
  return { me, friends: result }
}

async function requireAcceptedFriend(friendCode: string) {
  const me = await requireUser()
  const db = getDb()
  const code = normalizeCode(friendCode)
  const [other] = await db.select().from(users).where(eq(users.friendCode, code)).limit(1)
  if (!other || other.id === me.id) {
    throw new ApiError(404, 'Ami introuvable')
  }
  const pair = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, other.id)),
        and(eq(friendships.requesterId, other.id), eq(friendships.addresseeId, me.id)),
      ),
    )
  if (!pair.some((row) => row.status === 'accepted')) {
    throw new ApiError(403, 'Pas dans tes amis')
  }
  return { me, other }
}

export async function listDirectMessages(friendCode: string) {
  const { me, other } = await requireAcceptedFriend(friendCode)
  const db = getDb()
  const rows = await db
    .select()
    .from(directMessages)
    .where(
      or(
        and(eq(directMessages.fromUserId, me.id), eq(directMessages.toUserId, other.id)),
        and(eq(directMessages.fromUserId, other.id), eq(directMessages.toUserId, me.id)),
      ),
    )
    .orderBy(desc(directMessages.createdAt))
    .limit(100)
  await db
    .update(directMessages)
    .set({ read: true })
    .where(
      and(
        eq(directMessages.fromUserId, other.id),
        eq(directMessages.toUserId, me.id),
        eq(directMessages.read, false),
      ),
    )
  return {
    friend: { id: other.id, name: other.name, friendCode: other.friendCode, photoData: other.photoData },
    messages: rows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        fromMe: row.fromUserId === me.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
      })),
  }
}

export async function sendDirectMessage(friendCode: string, body: string) {
  const { me, other } = await requireAcceptedFriend(friendCode)
  const text = sanitizeMessage(body, 500)
  const db = getDb()
  const [row] = await db
    .insert(directMessages)
    .values({ fromUserId: me.id, toUserId: other.id, body: text })
    .returning()
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, other.id),
        eq(notifications.type, 'message'),
        eq(notifications.href, `/amis/${me.friendCode}`),
      ),
    )
  await notifyUser(other.id, {
    type: 'message',
    title: `${me.name} : ${text.slice(0, 80)}`,
    href: `/amis/${me.friendCode}`,
    body: text,
  })
  return {
    id: row.id,
    fromMe: true,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function inviteFriend(code: string, friendUserId: string) {
  const me = await requireUser()
  const db = getDb()
  const [session] = await db.select().from(sessions).where(eq(sessions.code, code.toUpperCase())).limit(1)
  if (!session || session.status === 'closed') {
    throw new ApiError(404, 'Session introuvable')
  }
  const friends = await listFriends()
  const ok = friends.friends.some((row) => row.status === 'accepted' && row.user.id === friendUserId)
  if (!ok) {
    throw new ApiError(403, 'Pas dans tes amis')
  }
  await db.insert(sessionInvites).values({
    sessionId: session.id,
    fromUserId: me.id,
    toUserId: friendUserId,
    status: 'pending',
  })
  await notifyUser(friendUserId, {
    type: 'invite',
    title: `${me.name} t’invite · ${session.code}`,
    href: `/session/${session.code}`,
    body: 'Tape pour rejoindre la session.',
  })
  return { ok: true }
}

export async function listNotifications() {
  const me = await requireUser()
  const db = getDb()
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, me.id))
    .orderBy(desc(notifications.createdAt))
    .limit(20)
  return rows
}

export async function markNotificationsRead() {
  const me = await requireUser()
  const db = getDb()
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, me.id))
}

export async function deleteNotification(id: string) {
  const me = await requireUser()
  const db = getDb()
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, me.id)))
}

export async function deleteNotificationsByHref(href: string) {
  const me = await requireUser()
  const db = getDb()
  await db.delete(notifications).where(and(eq(notifications.userId, me.id), eq(notifications.href, href)))
}

export async function profileStats() {
  const me = await requireUser()
  const [career] = await careersForUsers([
    { id: me.id, name: me.name, friendCode: me.friendCode },
  ])
  return {
    me,
    ...withMoneyLabels(career),
    history: await sessionHistoryForUser(me.id),
  }
}

export async function setAccountPhoto(photoData: string | null) {
  const me = await requireUser()
  const cleaned = sanitizePhoto(photoData)
  const db = getDb()
  await db.update(users).set({ photoData: cleaned }).where(eq(users.id, me.id))
  return { photoData: cleaned }
}

export async function getPlayerProfile(friendCode: string) {
  const me = await requireUser()
  const code = normalizeCode(friendCode)
  const [target] = await dbUserByFriendCode(code)
  if (!target) {
    throw new ApiError(404, 'Profil introuvable')
  }
  const isSelf = target.id === me.id
  let friendshipId: string | null = null
  if (!isSelf) {
    const { friends } = await listFriends()
    const relation = friends.find((row) => row.status === 'accepted' && row.user.id === target.id)
    if (!relation) {
      throw new ApiError(403, 'Profil réservé à tes amis')
    }
    friendshipId = relation.friendshipId
  }
  const [career] = await careersForUsers([
    { id: target.id, name: target.name, friendCode: target.friendCode },
  ])
  return {
    isSelf,
    friendshipId,
    user: { name: target.name, friendCode: target.friendCode, photoData: target.photoData },
    ...withMoneyLabels(career),
    history: isSelf ? await sessionHistoryForUser(target.id) : [],
  }
}

export async function friendLeaderboard(range: SeasonRange = 'month') {
  const { me, friends } = await listFriends()
  const people = [
    { id: me.id, name: me.name, friendCode: me.friendCode, photoData: me.photoData },
    ...friends.filter((row) => row.status === 'accepted').map((row) => row.user),
  ]
  const { from } = seasonWindow(range)
  const photos = new Map(people.map((row) => [row.id, row.photoData ?? null]))
  const rows = sortCareers(await careersForUsers(people, from), 'points').map((row) => ({
    ...withMoneyLabels(row),
    photoData: photos.get(row.userId) ?? null,
  }))
  return { meId: me.id, range, rows }
}

async function dbUserByFriendCode(code: string) {
  const db = getDb()
  return db.select().from(users).where(eq(users.friendCode, code)).limit(1)
}

async function careersForUsers(
  people: { id: string; name: string; friendCode: string }[],
  from: Date | null = null,
): Promise<Career[]> {
  const result = people.map(emptyCareer)
  if (people.length === 0) {
    return result
  }
  const db = getDb()
  const byId = new Map(result.map((row) => [row.userId, row]))
  const roster = await db.select().from(players).where(inArray(players.userId, people.map((row) => row.id)))
  const userByPlayer = new Map<string, string>()
  const playersByUser = new Map<string, string[]>()
  for (const player of roster) {
    if (!player.userId) {
      continue
    }
    userByPlayer.set(player.id, player.userId)
    const list = playersByUser.get(player.userId) ?? []
    list.push(player.id)
    playersByUser.set(player.userId, list)
  }
  const sessionIds = [...new Set(roster.map((player) => player.sessionId))]
  if (sessionIds.length === 0) {
    return result
  }
  let closed = await db
    .select()
    .from(games)
    .where(and(inArray(games.sessionId, sessionIds), eq(games.status, 'closed')))
  if (from) {
    closed = closed.filter((game) => (game.closedAt ?? game.createdAt) >= from)
  }
  if (closed.length === 0) {
    return result
  }
  const gameIds = closed.map((game) => game.id)
  const gameById = new Map(closed.map((game) => [game.id, game]))
  const allScores = await db.select().from(scores).where(inArray(scores.gameId, gameIds))
  const allTransfers = await db.select().from(transfers).where(inArray(transfers.gameId, gameIds))
  const gamesByUser = new Map<string, Set<string>>()

  for (const score of allScores) {
    const userId = userByPlayer.get(score.playerId)
    if (!userId) {
      continue
    }
    const row = byId.get(userId)
    if (!row) {
      continue
    }
    row.kills += score.kills
    row.revives += score.revives
    const set = gamesByUser.get(userId) ?? new Set<string>()
    set.add(score.gameId)
    gamesByUser.set(userId, set)
  }

  for (const game of closed) {
    if (!game.firstKillPlayerId) {
      continue
    }
    const userId = userByPlayer.get(game.firstKillPlayerId)
    const row = userId ? byId.get(userId) : undefined
    if (row) {
      row.firstKills += 1
    }
  }

  for (const transfer of allTransfers) {
    const toUser = userByPlayer.get(transfer.toPlayerId)
    const fromUser = userByPlayer.get(transfer.fromPlayerId)
    if (toUser) {
      const row = byId.get(toUser)
      if (row) {
        row.wonCents += transfer.amountCents
      }
    }
    if (fromUser) {
      const row = byId.get(fromUser)
      if (row) {
        row.lostCents += transfer.amountCents
      }
    }
  }

  for (const row of result) {
    const played = gamesByUser.get(row.userId) ?? new Set<string>()
    const mine = new Set(playersByUser.get(row.userId) ?? [])
    const snapshots: GameRecord[] = []
    for (const gameId of played) {
      const game = gameById.get(gameId)
      if (!game) {
        continue
      }
      const points = allScores
        .filter((score) => score.gameId === gameId && mine.has(score.playerId))
        .reduce((sum, score) => sum + score.kills + score.revives, 0)
      const lostCents = allTransfers
        .filter((transfer) => transfer.gameId === gameId && mine.has(transfer.fromPlayerId))
        .reduce((sum, transfer) => sum + transfer.amountCents, 0)
      const won = allTransfers.some((transfer) => transfer.gameId === gameId && mine.has(transfer.toPlayerId))
      snapshots.push({
        gameId,
        sessionId: game.sessionId,
        closedAt: (game.closedAt ?? game.createdAt).getTime(),
        points,
        won,
        lostCents,
      })
    }
    const records = personalRecords(snapshots)
    row.games = played.size
    row.sessions = new Set(snapshots.map((item) => item.sessionId)).size
    row.points = row.kills + row.revives
    row.netCents = row.wonCents - row.lostCents
    row.bestGame = records.bestGame
    row.winStreak = records.winStreak
    row.worstNightCents = records.worstNightCents
  }
  return result
}

async function sessionHistoryForUser(userId: string) {
  const db = getDb()
  const myPlayers = await db.select().from(players).where(eq(players.userId, userId))
  const playerIds = new Set(myPlayers.map((row) => row.id))
  const sessionIds = [...new Set(myPlayers.map((row) => row.sessionId))]
  const history: { code: string; wonCents: number; lostCents: number; games: number; isHost: boolean }[] = []

  for (const sessionId of sessionIds) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) {
      continue
    }
    const sessionPlayers = myPlayers.filter((row) => row.sessionId === sessionId)
    const sessionGames = await db
      .select()
      .from(games)
      .where(and(eq(games.sessionId, sessionId), eq(games.status, 'closed')))
    let sessionWon = 0
    let sessionLost = 0
    for (const game of sessionGames) {
      const rows = await db.select().from(transfers).where(eq(transfers.gameId, game.id))
      for (const row of rows) {
        if (playerIds.has(row.toPlayerId) && sessionPlayers.some((player) => player.id === row.toPlayerId)) {
          sessionWon += row.amountCents
        }
        if (playerIds.has(row.fromPlayerId) && sessionPlayers.some((player) => player.id === row.fromPlayerId)) {
          sessionLost += row.amountCents
        }
      }
    }
    history.push({
      code: session.code,
      wonCents: sessionWon,
      lostCents: sessionLost,
      games: sessionGames.length,
      isHost: sessionPlayers.some((player) => player.isHost),
    })
  }

  return history
}

export async function removeSessionFromProfile(code: string) {
  const me = await requireUser()
  const db = getDb()
  const sessionCode = normalizeCode(code)
  const [session] = await db.select().from(sessions).where(eq(sessions.code, sessionCode)).limit(1)
  if (!session) {
    throw new ApiError(404, 'Session introuvable')
  }
  const [mine] = await db
    .select()
    .from(players)
    .where(and(eq(players.sessionId, session.id), eq(players.userId, me.id)))
    .limit(1)
  if (!mine) {
    throw new ApiError(403, 'Cette session n’est pas dans ton historique')
  }
  if (mine.isHost) {
    await db.update(games).set({ firstKillPlayerId: null }).where(eq(games.sessionId, session.id))
    const sessionGames = await db.select({ id: games.id }).from(games).where(eq(games.sessionId, session.id))
    const gameIds = sessionGames.map((row) => row.id)
    if (gameIds.length > 0) {
      await db.delete(transfers).where(inArray(transfers.gameId, gameIds))
      await db.delete(gamePowers).where(inArray(gamePowers.gameId, gameIds))
    }
    await db.delete(notifications).where(eq(notifications.href, `/session/${session.code}`))
    await db.delete(sessions).where(eq(sessions.id, session.id))
    return { deletedForEveryone: true }
  }
  await db.update(players).set({ userId: null }).where(eq(players.id, mine.id))
  return { deletedForEveryone: false }
}
