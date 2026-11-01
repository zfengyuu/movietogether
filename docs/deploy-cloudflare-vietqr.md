# Deploy HộiRoom 3D on Cloudflare Containers + VietQR/SePay (sandbox)

This branch contains an implementation of a **single Cloudflare Container** hosting
React, Express, Socket.IO and the 3D application. It is not deployed to your
account by this repository change. The Worker forwards all HTTP and WebSocket
connections to one named Durable Object Container instance.

## Requirements

- Cloudflare account on **Workers Paid** plan; Containers is not supported on Free.
- External publicly reachable **PostgreSQL** connection with TLS, e.g. Neon,
  Supabase or managed Postgres. Cloudflare D1 is NOT PostgreSQL.
- GitHub repo access, Docker engine if using CLI locally, and Node 22.
- **No real-money payments**. Sandbox testing only until code, banking, legal,
  reconciliation and security have been independently reviewed.

## Deploy CLI

Use the branch `deploy/cloudflare-containers-vietqr-20261101`:

```bash
git clone https://github.com/zfengyuu/movietogether.git
cd movietogether
git checkout deploy/cloudflare-containers-vietqr-20261101
npm install
npx wrangler login

# Saves the connection string securely on the Worker (never in Git or wrangler.jsonc):
npx wrangler secret put DATABASE_URL

# Docker or a compatible daemon must be running when building Dockerfile.cloudflare.
npm run deploy:cloudflare
```

If a new deployment shows a Worker URL but not the app, check Containers
provisioning and logs. The Worker uses `basic` container size (1 GiB RAM),
port 3001 and `enableInternet: true` for PostgreSQL networking.

**Database migrations** (`001_wallet.sql` and `002_auth.sql`) run in the
Container command **before** Express begins listening. Failed DB access or
migration blocks startup. Only one named instance is used while rooms,
Socket.IO users and photo queues are stored in memory.

### GitHub CI / Dashboard-based deploy

Cloudflare → Workers & Pages → Create Application → GitHub.
Choose this repo and set production branch to this branch for the preview
application (do not point the production Worker to a feature branch by accident).
Set Build command to `npm install` and Deploy command to
`npx wrangler deploy`, using the repository root. Workers Paid is required.
Workers Builds can build the Docker image. Non-production branches only
upload Worker versions by default, not Container images.

Add `DATABASE_URL` as an **encrypted secret** via Worker Settings → Variables and
Secrets, not as a plain variable in the repository.

## Cloudflare VietQR and SePay environment variables

The Cloudflare **Worker** passes these variables and secrets into the Container
when starting it. Setting an env var on the Worker alone is insufficient unless
the Worker passes it through to `ctx.container.start({env:...})`; this branch does.

| Name | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | **Secret required** | External PostgreSQL URI used for login, wallet, orders |
| `VIMO_BANK_ID` | Secret or variable | VietQR supported bank BIN, e.g. actual BIN of your sandbox bank |
| `VIMO_BANK_ACCOUNT` | Secret | **Sandbox/test receiving account only** |
| `VIMO_BANK_NAME` | Secret or variable | Bank account holder's name for QR |
| `VIETQR_BANK_ACCOUNT` | Secret | Must **equal VIMO_BANK_ACCOUNT**; verified by webhook |
| `SEPAY_WEBHOOK_SECRET` | **Secret** | HMAC-SHA256 key copied from SePay Test mode |
| `PAYMENTS_MODE` | Non-secret in `wrangler.jsonc` | `disabled` by default; `sandbox` only after safe test setup |
| `DEMO_WALLET_ENABLED` | Non-secret | `false` in production |

Configure values with:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put VIMO_BANK_ID
npx wrangler secret put VIMO_BANK_ACCOUNT
npx wrangler secret put VIMO_BANK_NAME
npx wrangler secret put VIETQR_BANK_ACCOUNT
npx wrangler secret put SEPAY_WEBHOOK_SECRET
```

When all **test** credentials are set, change `PAYMENTS_MODE` in
`wrangler.jsonc` from `disabled` to `sandbox`, commit, then run
`npm run deploy:cloudflare`. Do not set `PAYMENTS_MODE=live`:
this backend deliberately doesn't support live credits yet.

**Important:** The QR URL returned by `/api/wallet/topup-orders`
is now generated with the **same unique code** as the persistent topup order.
The legacy `/api/wallet/vietqr-intent` endpoint returns HTTP 410 because its
old in-memory reference cannot be credited by the SQL ledger. UI's sandbox
modal can show the test QR when the bank config matches and a signed webhook
secret is available. It is **not a real-money checkout**.

### SePay Test mode

1. Open SePay Test mode, configure a test receiving bank account and copy its
   secret in the Webhooks configuration. Do NOT use your real bank credentials.
2. Create an Incoming Money webhook pointing to
   `https://<worker-subdomain>.workers.dev/api/webhooks/sepay`
   or `https://your-domain.com/api/webhooks/sepay`.
3. Security: **HMAC-SHA256**. SePay signs raw body with
   `X-SePay-Signature: sha256=...` and `X-SePay-Timestamp`.
4. Set `SEPAY_WEBHOOK_SECRET` and the test account ID (exact string)
   in `VIETQR_BANK_ACCOUNT`, matching `VIMO_BANK_ACCOUNT`.
5. Register an account, open the **Ủng hộ/Nạp ví thử** modal, create a SQL
   topup order (10,000+ VND simulated), and use the **simulated** SePay
   incoming transaction with **exact amount** and **exact unique order code**.
6. Once SePay issues a signed callback, the SQL ledger credits at most once.
   `GET /api/wallet/me` shows the updated balance and the app emits
   `wallet_state` to logged-in users.
7. If a pending image is still valid and its user remains in the room, it
   can continue after wallet credit. Pending room state is **ephemeral**.

### What VietQR alone does NOT do

VietQR constructs a QR with transfer instructions; scanning it **is not payment
verification**. A successful transfer is recognized only through the signed
SePay webhook, a matching SQL order, the exact amount, matching beneficiary
account, and a unique bank transaction ID. Never trust a browser-side
'I've paid' button, screenshot or arbitrary transfer message.

## Custom domain and HTTPS

In Cloudflare Workers & Pages → `hoiroom-3d` → Settings → Domains & Routes,
add a custom domain that belongs to a zone in the same Cloudflare account.
Cloudflare manages HTTPS for the Worker. Check that `/api/*` and
`/socket.io/*` remain uncached and WebSockets are allowed.

## Limitations / what must be built before production

- **Uploads are ephemeral.** The container uses `/tmp/hoiroom`, which is lost
  whenever the instance stops or moves. Use R2 object storage (or supported
  R2 FUSE mount) for photo/audio uploads before offering paid screen pictures.
- **Rooms/queue/pending photo state are in RAM** and are lost on container
  restarts. One named container is intentional for correct realtime routing.
  Multi-container scale requires Redis adapter and durable room state.
- Containers may stop or be moved by Cloudflare; no uptime SLA for one instance.
  Websocket requests should be reconnected by clients.
- PostgreSQL must be reachable from the container, with TLS; external
  Postgres fees are independent from Cloudflare.
- Provider embeds for YouTube and SoundCloud are subject to their own rules.
- **No live-payment functionality.** Keep sandbox-only until full verification
  and reconciliation. Never paste your SePay secret or real bank details into
  ChatGPT/GitHub issue comments/public files.

Documentation references:
- https://developers.cloudflare.com/containers/get-started/
- https://developers.cloudflare.com/containers/guides/deploy/
- https://developers.cloudflare.com/containers/examples/env-vars-and-secrets/
- https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
