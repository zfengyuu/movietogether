-- Run on a dedicated PostgreSQL database before turning on sandbox payment flows.
-- Auth account UUIDs are currently managed by the demo auth system; user_id binds wallet to that UUID.
BEGIN;
CREATE TABLE IF NOT EXISTS wallets (
 user_id UUID PRIMARY KEY,
 balance BIGINT NOT NULL DEFAULT 0 CHECK(balance >= 0),
 demo_credited BOOLEAN NOT NULL DEFAULT FALSE,
 skins TEXT[] NOT NULL DEFAULT '{}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS topup_orders (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES wallets(user_id),
 amount BIGINT NOT NULL CHECK(amount BETWEEN 10000 AND 1000000),
 code TEXT UNIQUE NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','paid','expired','cancelled')),
 provider_tx_id TEXT UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS topup_pending_lookup ON topup_orders(amount,created_at) WHERE status='pending';
CREATE TABLE IF NOT EXISTS bank_transactions (
 provider_tx_id TEXT PRIMARY KEY,
 order_id UUID NOT NULL UNIQUE REFERENCES topup_orders(id),
 amount BIGINT NOT NULL CHECK(amount > 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wallet_ledger (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES wallets(user_id),
 type TEXT NOT NULL CHECK(type IN('verified_topup','photo_spend','demo_credit','skin_spend')),
 amount BIGINT NOT NULL CHECK(amount <> 0),
 description TEXT NOT NULL,
 order_id UUID UNIQUE REFERENCES topup_orders(id),
 photo_id UUID UNIQUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wallet_ledger_by_user ON wallet_ledger(user_id,created_at DESC);
COMMIT;
