-- Unlisted rows retain only the opaque ID and newest revision, preventing stale resurrection.
CREATE TABLE IF NOT EXISTS room_directory (
  room_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  listing TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions (expires_at);
