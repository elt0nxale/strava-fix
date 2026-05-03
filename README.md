# strava-fix

Cloudflare Worker that intercepts Strava webhook events and re-types slow "Run" activities as Walk or Hike in real time. Built for Garmin users whose watches push every activity as a run.

---

## How it works

![Overview Diagram](image-1.png)
Tokens are stored in KV and refreshed automatically. The dashboard at `/` handles OAuth, settings, and a fix log.

---

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers (free tier) |
| Storage | Cloudflare KV — tokens, settings, log |
| Auth | Strava OAuth 2.0 |
| Secrets | `wrangler secret` — never in source |

---

## Secrets

Set via `wrangler secret put`, never committed:

```
STRAVA_CLIENT_ID      — numeric app ID from strava.com/settings/api
STRAVA_CLIENT_SECRET  — secret string from same page
```

KV namespace bound as `AF_KV` in `wrangler.toml`.

---

## Deploy

```bash
# 1. Create KV namespaces and paste IDs into wrangler.toml
wrangler kv namespace create AF_KV
wrangler kv namespace create AF_KV --preview

# 2. Set secrets
wrangler secret put STRAVA_CLIENT_ID
wrangler secret put STRAVA_CLIENT_SECRET

# 3. Deploy
wrangler deploy

# 4. Open dashboard → Connect Strava → Setup Webhook
```

Strava callback domain must match your worker URL in `strava.com/settings/api`.

---

## Files

```
src/
  index.js   — router, webhook handler, fix logic, OAuth flow
  strava.js  — Strava API client (tokens, activities, webhooks)
  html.js    — dashboard UI
wrangler.toml
```

---

## Fix logic

```js
// Re-types if sport_type === 'Run' AND either:
avg_speed * 3.6 < speed_threshold_kmh   // default 7.0
|| activity.name.toLowerCase().includes('walk')  // if name-match enabled
```

Resulting name format: `Evening Walk #14` — time-of-day prefix + incremental counter seeded from KV.

---

## Dashboard

| Route | Purpose |
|---|---|
| `GET /` | Dashboard |
| `GET /auth` | Start Strava OAuth |
| `GET /auth/callback` | OAuth callback |
| `GET /webhook` | Strava webhook verification |
| `POST /webhook` | Strava webhook event |
| `POST /api/settings` | Save settings |
| `POST /api/setup-webhook` | Register webhook with Strava |
| `POST /api/disconnect` | Clear tokens |

---

## Notes

- Single-user by design — one token set in KV, no session layer
- `hide_from_home: true` removes fixed activities from follower feeds; full `only_me` privacy isn't available via the Strava API for device-uploaded activities
- To seed the walk counter to a specific number: `wrangler kv key put --binding=AF_KV walk_count "N"`