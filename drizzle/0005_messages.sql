ALTER TABLE scores ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  from_player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
