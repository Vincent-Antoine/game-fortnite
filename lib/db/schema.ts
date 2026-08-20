import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(),
  stakeCents: integer('stake_cents').notNull().default(25),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    avatar: text('avatar').notNull().default('drop'),
    isHost: boolean('is_host').notNull().default(false),
    color: text('color').notNull(),
    tokenHash: text('token_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('players_session_name').on(table.sessionId, table.name)],
)

export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('open'),
  firstKillPlayerId: uuid('first_kill_player_id').references(() => players.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
})

export const scores = pgTable(
  'scores',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    kills: integer('kills').notNull().default(0),
    revives: integer('revives').notNull().default(0),
  },
  (table) => [uniqueIndex('scores_game_player').on(table.gameId, table.playerId)],
)

export const transfers = pgTable('transfers', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id')
    .notNull()
    .references(() => games.id, { onDelete: 'cascade' }),
  fromPlayerId: uuid('from_player_id')
    .notNull()
    .references(() => players.id),
  toPlayerId: uuid('to_player_id')
    .notNull()
    .references(() => players.id),
  amountCents: integer('amount_cents').notNull(),
})
