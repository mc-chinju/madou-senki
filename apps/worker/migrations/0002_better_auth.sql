-- Better Auth accounts replace guest sessions. Guest actor IDs are not migrated.
-- Column names are Better Auth defaults. Dates are ISO-8601 text and booleans are 0/1 on D1.
DROP TABLE IF EXISTS sessions;

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
-- Display names are unique. A named index (not an inline constraint) so the local browser-test
-- database alone can drop it for fixtures that seat two tables with the same names.
CREATE UNIQUE INDEX IF NOT EXISTS user_name ON "user" (name);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY NOT NULL,
  expiresAt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user ON session (userId);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS account_user ON account (userId);

-- UNIQUE identifier: a resent OTP replaces the previous code instead of leaving it valid.
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS passkey (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  publicKey TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  credentialID TEXT NOT NULL,
  counter INTEGER NOT NULL,
  deviceType TEXT NOT NULL,
  backedUp INTEGER NOT NULL,
  transports TEXT,
  createdAt TEXT,
  aaguid TEXT
);
CREATE INDEX IF NOT EXISTS passkey_user ON passkey (userId);
CREATE INDEX IF NOT EXISTS passkey_credential ON passkey (credentialID);

-- Better Auth's secondary limiter. last_request stays an integer millisecond value.
CREATE TABLE IF NOT EXISTS rate_limit (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL,
  last_request INTEGER NOT NULL
);

-- Primary guard in front of the handler: one atomic upsert per attempt.
CREATE TABLE IF NOT EXISTS auth_attempt (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Serializes OTP send and verify for the same email address.
CREATE TABLE IF NOT EXISTS auth_lease (
  email TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
