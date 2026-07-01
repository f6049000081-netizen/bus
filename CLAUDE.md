# CLAUDE.md — Between Us (BUS)

## Commands

### API (`apps/api/`)
```bash
npm run dev                   # tsx watch
npx prisma db push            # push schema (no migration)
npx prisma migrate dev --name <name>
npx prisma generate
```

### Mobile (`apps/mobile/`)
```bash
npx expo start --host lan --clear
```

## Architecture

### Monorepo
```
apps/api/        Express + Prisma + PostgreSQL + Redis
apps/mobile/     Expo Router React Native
packages/shared/ Types + Axios client
```

## CRITICAL Privacy Constraint

**Raw phone numbers MUST NEVER be uploaded, stored in plaintext, or logged.**

The hashing pipeline:
1. Server issues a per-user `salt` on registration (returned in verify-otp response, stored in SecureStore)
2. Mobile normalizes each contact phone to E.164 via `libphonenumber-js`
3. Mobile computes `SHA256(salt + ":" + e164Phone)` on-device via `expo-crypto`
4. Only the hex hash is synced — never the raw number or contact name
5. Intersection runs server-side on hashes only (`services/psi.ts`)
6. After matching, the app resolves contact names from the user's own local address book

Any code that would upload raw phone numbers or contact names is a privacy violation.

## Data Model
- `User`: id, phoneHash, phoneHint (last 4 only), displayName, salt
- `ContactHash`: id, userId, contactHash, frequencyBucket, excluded
- `ComparisonSession`: one-time token (10min TTL)
- `Comparison`: sessionId, userAId, userBId, mutualCount, mutualContactHashes[]

## Key Constraints
- `ContactHash.contactHash` is always 64-char lowercase hex (SHA-256 output)
- `frequencyBucket`: 'frequent' | 'occasional' | 'rare' | 'unknown' — never raw call counts
- All IDs use `uuid()`
- JWT access tokens: 15min. Refresh tokens: 30 days, hashed in DB
- Rate limit OTP requests: 3/min per IP
- Contact sync: full replace (delete + insert) for MVP simplicity
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
PORT=3000

# apps/mobile/.env
EXPO_PUBLIC_API_URL=http://<LAN_IP>:3000
```

## Phase Roadmap
- **Phase 1** (current): Scaffolding, phone OTP auth, contact permission + hashing, sync endpoint
- **Phase 2**: Comparison session (QR/link), backend intersection, mutual contact list UI
- **Phase 3**: Call-log frequency scoring (Android) + manual fallback (iOS), frequency-bucket sync
- **Phase 4**: Match history, circles, warm intro finder, notifications, privacy dashboard
- **Phase 5**: Trust indicator, group comparison, polish
