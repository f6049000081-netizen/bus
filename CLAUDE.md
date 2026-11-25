# CLAUDE.md — Between Us (BUS)

## Commands

### API (`apps/api/`)
```bash
npm run dev                   # tsx watch
npm run build                 # tsc -> dist/
npx prisma migrate dev --name <name>   # schema changes (prod runs `prisma migrate deploy`)
npx prisma generate
```

### Mobile (`apps/mobile/`)
```bash
npx expo start --host lan --clear
eas build -p android --profile preview      # APK (production profile = app-bundle)
```

## Architecture

### Monorepo
```
apps/api/        Express + Prisma + PostgreSQL + Redis
apps/mobile/     Expo Router React Native (Expo SDK 57)
packages/shared/ Types + Axios client
```

### API routes (`apps/api/src/routes/`)
- `/api/auth`: request-otp, verify-otp, refresh, logout
- `/api/contacts`: `POST /sync` (full replace), `PATCH /sync` (incremental upsert/remove), `GET /search?hash=`, `POST /bulk-lookup`, `DELETE /`
- `/api/comparison`: `POST /session`, `POST /join/:token`, `GET /session/:id`, `GET /:id`, `GET /`, `DELETE /:id`
- `/api/user`: `GET|PATCH|DELETE /me`
- `/api/notifications`: `POST|DELETE /token` (Expo push)

### Mobile
- Screens: `(auth)/` welcome → phone → verify (captures display name); `(app)/` home+search, dial, compare (QR), history, privacy; `compare/[token]`, `result/[id]`, `warm-intro`
- Android native call-log module: `modules/call-log` + config plugin `plugins/withCallLog.js`
- Android caller ID / call-screening role (Android 10+): `src/services/callerIdService.ts`
- iOS has no call-log access → frequency falls back gracefully

### Deployment
- API: DigitalOcean App Platform, `https://bus-api-vwcte.ondigitalocean.app`. Built from `apps/api/Dockerfile` with the monorepo root as build context; the container runs `prisma migrate deploy` on start.
- Mobile: EAS builds (`eas.json` sets `EXPO_PUBLIC_API_URL` for preview/production).
- `railway.json` files are leftovers from the earlier Railway deploy and are no longer used.

## CRITICAL Privacy Constraint

**Raw phone numbers MUST NEVER be uploaded (except the user's own number during OTP auth), stored in plaintext, or logged.**

The hashing pipeline:
1. Mobile normalizes each contact phone to E.164 via `libphonenumber-js` (default country `ET`; `09xxxxxxxx` → `+2519xxxxxxxx`)
2. Mobile computes `SHA256("bus-contacts-v1:" + e164Phone)` on-device via `expo-crypto` (`src/services/hashing.ts`)
3. Only the hex hash is synced, never the raw number or contact name
4. Intersection runs server-side on hashes only (`services/psi.ts`)
5. After matching, the app resolves contact names from the user's own local address book

**Contact salt is a fixed app-level constant (`bus-contacts-v1`), not per-user.** Per-user salts made intersection impossible and were dropped. The server's `hashForLookup()` uses the same constant so `User.lookupHash` matches contact hashes, which is how BUS users are discovered. The per-user `User.salt` and `phoneHash` still exist but are only used for the user's own record.
- Known risk: E.164 numbers are a small keyspace, so fixed-salt hashes can be brute-forced by anyone with DB access. Treat the `ContactHash` table as sensitive.

Logging rules:
- Never `console.*` a phone number. Show the last 4 digits at most (same as `phoneHint`).
- The global error handler logs and returns `redactPhones(...)` output (`services/redact.ts`), because upstream errors (Twilio) can echo the number. Never log raw error objects.

Any code that would upload raw contact numbers or contact names is a privacy violation.

## Data Model (`apps/api/prisma/schema.prisma`)
- `User`: id, phoneHash (per-user salt), lookupHash (fixed salt, unique), phoneHint (last 4), displayName, salt
- `RefreshToken`: tokenHash (SHA-256), expiresAt
- `ContactHash`: userId, contactHash, frequencyBucket, callCountWeek/Month/Total, excluded, lastSyncedAt. Unique on (userId, contactHash).
- `ComparisonSession`: one-time token (10min TTL), usedAt
- `Comparison`: sessionId, userAId, userBId, mutualCount, mutualContactHashes[]
- `MutualContact`: per-comparison hash with each side's week/month/total call counts
- `PushToken`: Expo push tokens per user

## Key Constraints
- `ContactHash.contactHash` is always 64-char lowercase hex (SHA-256 output)
- `frequencyBucket`: 'frequent' | 'occasional' | 'rare' | 'unknown'
- Raw call counts (`callCount*`, `MutualContact` counts) ARE stored server-side to power the Top 10 / This Week / This Month views. This differs from the original "buckets only" design.
- All IDs use `uuid()`
- JWT access tokens: 15min. Refresh tokens: 30 days, hashed in DB
- Rate limit OTP requests: 3/min per IP (relaxed when `DEV_OTP_BYPASS=true`); global 120 req/min
- `DEV_OTP_BYPASS=true` accepts code `123456` and skips Twilio. It must be off in production.
- One-tap data deletion: `DELETE /api/contacts` (hashes only) and `DELETE /api/user/me` (full account)

## Environment Variables

```
# apps/api/.env
DATABASE_URL=postgresql://bus:bus_pass@localhost:5432/bus_db
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
DEV_OTP_BYPASS=false
PORT=3000

# apps/mobile/.env
EXPO_PUBLIC_API_URL=http://<LAN_IP>:3000
```

## Status / Roadmap
- **Phase 1 (done)**: scaffolding, phone OTP auth, contact hashing, sync
- **Phase 2 (done)**: comparison session (QR/link), backend intersection, mutual contact UI
- **Phase 3 (done)**: Android call-log frequency scoring, iOS fallback
- **Phase 4 (mostly done)**: match history, warm intro finder, push notifications, privacy screen and contact exclusion are built. **Circles are not built.**
- **Extras shipped**: phone-number search (own contacts, BUS users, who-saved-it, past matches), dialer with tap-to-call, incoming caller ID, intro animation
- **Phase 5 (not started)**: trust indicator, group comparison, polish
