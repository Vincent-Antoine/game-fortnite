CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  stake_cents integer NOT NULL DEFAULT 25,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar text NOT NULL DEFAULT 'drop',
  is_host boolean NOT NULL DEFAULT false,
  color text NOT NULL,
  token_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS players_session_name ON players (session_id, name);

CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  first_kill_player_id uuid REFERENCES players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kills integer NOT NULL DEFAULT 0,
  revives integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS scores_game_player ON scores (game_id, player_id);

CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  from_player_id uuid NOT NULL REFERENCES players(id),
  to_player_id uuid NOT NULL REFERENCES players(id),
  amount_cents integer NOT NULL
);
