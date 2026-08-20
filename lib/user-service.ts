import { and, desc, eq, or } from 'drizzle-orm'
import { ApiError } from '@/lib/errors'
import { getAuthUser, hashToken, newToken, setUserCookie } from '@/lib/auth'
import { randomCode } from '@/lib/code'
import { getDb } from '@/lib/db'
import {
  friendships,
  games,
  notifications,
  players,
  sessionInvites,
  sessions,
  transfers,
  userSessions,
  users,
} from '@/lib/db/schema'
import { formatCents } from '@/lib/money'
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

function publicUser(user: { id: string; email: string; name: string; friendCode: string }) {
  return { id: user.id, email: user.email, name: user.name, friendCode: user.friendCode }
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
  await db.insert(notifications).values({
    userId: target.id,
    type: 'friend',
    title: `${me.name} veut t’ajouter`,
    href: '/amis',
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
  await db.insert(notifications).values({
    userId: row.requesterId,
    type: 'friend',
    title: `${me.name} a accepté`,
    href: '/amis',
  })
  return listFriends()
}

export async function listFriends() {
  const me = await requireUser()
  const db = getDb()
  const rows = await db.select().from(friendships).where(
    or(eq(friendships.requesterId, me.id), eq(friendships.addresseeId, me.id)),
  )
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
      user: { id: other.id, name: other.name, friendCode: other.friendCode },
    })
  }
  return { me, friends: result }
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
  await db.insert(notifications).values({
    userId: friendUserId,
    type: 'invite',
    title: `${me.name} t’invite · ${session.code}`,
    href: `/session/${session.code}`,
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

export async function profileStats() {
  const me = await requireUser()
  const db = getDb()
  const myPlayers = await db.select().from(players).where(eq(players.userId, me.id))
  const playerIds = new Set(myPlayers.map((row) => row.id))
  const sessionIds = [...new Set(myPlayers.map((row) => row.sessionId))]
  let won = 0
  let lost = 0
  let gameCount = 0
  const history: { code: string; wonCents: number; lostCents: number; games: number }[] = []

  for (const sessionId of sessionIds) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
    if (!session) {
      continue
    }
    const sessionPlayers = myPlayers.filter((row) => row.sessionId === sessionId)
    const sessionGames = await db.select().from(games).where(and(eq(games.sessionId, sessionId), eq(games.status, 'closed')))
    gameCount += sessionGames.length
    let sessionWon = 0
    let sessionLost = 0
    for (const game of sessionGames) {
      const rows = await db.select().from(transfers).where(eq(transfers.gameId, game.id))
      for (const row of rows) {
        if (playerIds.has(row.toPlayerId) && sessionPlayers.some((player) => player.id === row.toPlayerId)) {
          sessionWon += row.amountCents
          won += row.amountCents
        }
        if (playerIds.has(row.fromPlayerId) && sessionPlayers.some((player) => player.id === row.fromPlayerId)) {
          sessionLost += row.amountCents
          lost += row.amountCents
        }
      }
    }
    history.push({
      code: session.code,
      wonCents: sessionWon,
      lostCents: sessionLost,
      games: sessionGames.length,
    })
  }

  return {
    me,
    games: gameCount,
    sessions: sessionIds.length,
    wonCents: won,
    lostCents: lost,
    netCents: won - lost,
    wonLabel: formatCents(won),
    lostLabel: formatCents(lost),
    netLabel: formatCents(won - lost),
    history,
  }
}
