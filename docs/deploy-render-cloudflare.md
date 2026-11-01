# Deploy HộiRoom on Render + Cloudflare

This branch is prepared for a **single-instance** React + Express + Socket.IO app with a PostgreSQL database.
It does **not** enable real-money VietQR/SePay topups. Keep `PAYMENTS_MODE=disabled` until you have validated a signed webhook against a test bank account.

## 1. Create the Render Blueprint

1. Render Dashboard → **New** → **Blueprint** → connect GitHub repo `zfengyuu/movietogether`.
2. Select branch `deploy/render-cloudflare-production-20261101` (or a branch that includes the deployment changes after merging).
3. Use `render.yaml`: it provisions **hoiroom-web** (Docker) and **hoiroom-postgres** (PostgreSQL) in Singapore.
4. Choose/approve paid instances. The web service has a 1 GB persistent disk at `/app/storage` for uploaded audio/images.
5. `preDeployCommand: npm run db:migrate` creates/updates both **wallet** and **auth** tables on every deployment. A failed migration prevents that revision from going live.
6. Open `https://<your-web-service>.onrender.com/api/health`; response should include `ok: true`. Then visit the web app and create a new account.
7. For any existing users previously kept in `auth-data/accounts.json`, **do not publish until you have backed up and imported them** with `node scripts/import-legacy-accounts.mjs` against the same DATABASE_URL. Never check the JSON file into git.

Render's paid web service is required for pre-deploy commands and persistent disk. **A disk disables zero-downtime deploys and multi-instance scaling**. Rooms, queues, presence, temporary video state and pending photo requests still live in server RAM: a restart resets them. Move media to R2 and room state to Redis before scaling horizontally.

## 2. Environment variables

Blueprint provides:
```dotenv
NODE_ENV=production
SERVE_STATIC=true
DEMO_WALLET_ENABLED=false
PAYMENTS_MODE=disabled
DATABASE_URL=(Render-managed postgres connection string)
UPLOAD_ROOT=/app/storage
```

Render injects PORT; no need to set it. The app serves React + Express + Socket.IO on the **same domain** and does not require a separate frontend.
`FRONTEND_ORIGIN` may be set to comma-separated explicitly trusted frontend origins **only if** you split the frontend onto another origin. Same-origin is the default for production.

**Important:** never paste `DATABASE_URL`, payment credentials, or secrets into git, a public issue, or the browser.
`pg` is installed by the Docker build. An existing historical package-lock is reconciled by `npm install` during image creation. After running `npm install` on a connected development machine, commit the regenerated lockfile for reproducible `npm ci` builds.

## 3. Cloudflare DNS / domain

1. Purchase a domain (e.g. `hoiroom.com` if available) and add it to Cloudflare.
2. In Render's **hoiroom-web → Settings → Custom Domains**, add that domain. Render will show the required DNS records.
3. In Cloudflare DNS enter **exactly** the `CNAME`/`A` records Render instructs; avoid conflicting records.
4. If certificate verification gets stuck, temporarily use **DNS only** (grey cloud). Once the domain is verified and Render HTTPS is active, optionally enable Cloudflare proxy (orange cloud) and set **SSL/TLS → Full (strict)**.
5. Leave **WebSockets enabled** in Cloudflare; do not cache `/socket.io/*`, `/api/*`, or private user responses. Cloudflare caching rules should target only immutable static assets.
6. With Cloudflare, the TLS certificate on Render remains required even when Cloudflare proxies traffic.

## 4. VietQR / SePay later

The existing `/api/webhooks/sepay` implementation is **sandbox-only** and uses a signed webhook. A QR is a payment instruction, not proof of credit.
```dotenv
PAYMENTS_MODE=disabled
# When testing in a controlled sandbox only:
# PAYMENTS_MODE=sandbox
# SEPAY_WEBHOOK_SECRET=(never expose)
# VIETQR_BANK_ACCOUNT=(sandbox receiving account)
```
Keep the production environment disabled until the QR order flow, signature verification, account-bound ledger, reconciliation and idempotency have been validated with the payment provider. No live payments should be accepted using the current demo flow.

## 5. Operational limitations

- Persistent disk is for **one** server only. Build/pre-deploy instances cannot see its files; migrations use PostgreSQL, not the disk.
- Files saved in `UPLOAD_ROOT` survive app redeploys; data outside that folder does not.
- `POST /api/upload-photo` and audio upload use runtime filesystem, so do not deploy without persistent disk if you need file retention.
- Keep the instance count at 1 while Socket.IO rooms and stage positions are held in RAM. Add Redis adapter + centralized rooms, rate limiting, job queues and R2 before autoscaling.
- Back up the database and media storage before enabling real-money wallet transactions.
- YouTube and SoundCloud playback depend on each provider's embedding restrictions.
