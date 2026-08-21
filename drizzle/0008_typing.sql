ALTER TABLE users ADD COLUMN IF NOT EXISTS typing_to_user_id uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS typing_at timestamptz;
