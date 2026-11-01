-- Accounts are authoritative in PostgreSQL whenever DATABASE_URL is configured.
-- Case-insensitive unique username constraint prevents registration races.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_accounts (
 id UUID PRIMARY KEY,
 username VARCHAR(24) NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,24}$'),
 salt CHAR(32) NOT NULL,
 password_hash CHAR(128) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_username_ci ON auth_accounts ((LOWER(username)));
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
COMMIT;
