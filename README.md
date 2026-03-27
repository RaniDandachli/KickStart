# KickClash — Phase 1 scaffold

Production-oriented MVP shell for a competitive 1v1 arcade soccer-style game: **Expo Router + React Native**, **TanStack Query**, **Zustand**, **NativeWind**, **Zod**, and **Supabase** (Auth, Postgres, Realtime hooks, Edge Function stubs). Gameplay physics are intentionally stubbed behind a reusable match session model and placeholder screen.

**Monetization & compliance:** no gambling, wagering, P2P betting, pooled cash prizes, or cash-entry tournaments. Tournaments use free entry, credits, sponsors, or admin-granted prizes only. Stripe is scoped to subscriptions, cosmetics, battle pass–style entitlements, and similar non-cash SKUs.

---

## Quick start

```bash
cd KickClash
npm install
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_* then:
npx expo start
```

Run tests:

```bash
npm test
```

Typecheck:

```bash
npx tsc --noEmit
```

---

## Supabase: SQL migration order

Apply files in `sql/migrations` **in numeric order** on your Supabase project (SQL editor or `supabase db push` after linking):

| Order | File | Purpose |
|-------|------|--------|
| 1 | `00001_schema.sql` | Tables, indexes, `updated_at` triggers |
| 2 | `00002_rls.sql` | RLS + `is_staff()` helper (**service role** bypasses RLS for admin Edge Functions) |
| 3 | `00003_auth_profile_trigger.sql` | `handle_new_user` → `profiles`, `user_stats`, default `ratings` rows |

Then optional seed reference data:

- `sql/seed/00001_seed_reference_data.sql` — seasons, achievements, cosmetics, sample tournaments (no `auth.users` dependency).

**Demo users / leaderboard rows tied to real profiles:** create accounts via the app or Supabase Auth, then insert child rows (`leaderboard_snapshots`, `transactions`, …) referencing those profile UUIDs. The client falls back to small in-app mocks when tables are empty.

---

## Architecture (high level)

- **`app/`** — Expo Router routes: `(auth)` (sign-in/up/onboarding), `(app)/(tabs)` (Home, Tournaments stack, Play stack, Leaderboard, Profile stack).
- **`features/`** — Screen-level UI modules (gameplay stub, queue UX, bracket preview, tournament copy).
- **`components/ui`** — Reusable primitives (card, badge, buttons, screen shell).
- **`services/api`** — Supabase-backed fetchers; swap in Edge Functions for writes that need integrity (`recordMatchResult`, tournament joins with debits).
- **`services/matchmaking`** — `MatchmakingService` interface + mock implementation; replace with Realtime + ticket service.
- **`hooks/`** — TanStack Query hooks, auth bootstrap, Realtime invalidate scaffold.
- **`store/`** — Zustand: auth mirror, matchmaking UI phase.
- **`supabase/client.ts`** — typed `createClient<Database>`.
- **`types/database.ts`** — Hand-maintained `Database` generic (**includes `Relationships: []`** per postgrest-js). Regenerate from Supabase CLI when the schema stabilizes.
- **`utils/rating.ts`** — Elo-style helpers; **`utils/bracket.ts`** — single-elim pairing for UI + Edge parity.
- **`sql/`** — Migrations + seed.
- **`supabase/functions/`** — Deno Edge Function stubs (Zod + JWT checks + service-role patterns).

**Admin / moderation:** roles live on `profiles.role`. Policies allow broad **read** for gameplay UX; privileged **writes** should go through **Edge Functions** using the **service role** key (server-side only). Never ship the service key in the app.

---

## Edge Functions

Implemented as HTTP handlers with shared `supabase/functions/_shared/http.ts`. Deploy with Supabase CLI (`supabase functions deploy <name>`). Each validates input with Zod, checks a JWT via the user-scoped client where appropriate, and uses the service role for privileged DB writes.

| Function | Role |
|----------|------|
| `createTournament` | Admin creates tournaments + audit log |
| `joinTournament` | Join flow scaffold (TODO: atomic credit debit) |
| `lockTournament` | Admin locks bracket intake |
| `generateBracket` | Stub response — port `utils/bracket` to Deno |
| `recordMatchResult` | Insert `match_results` with audit ref |
| `resolveDispute` | Moderation audit + TODO state machine |
| `awardPrize` | Admin grant scaffold (non-cash) |
| `seasonReset` | Audit-only stub |
| `syncSubscriptionStatus` | Upsert `subscriptions` + ledger row (Stripe webhook TODO) |

---

## Realtime

`hooks/useRealtimeScaffold.ts` subscribes when `EXPO_PUBLIC_ENABLE_REALTIME=true` after you enable replication for the listed tables in Supabase.

---

## NativeWind

`babel.config.js`, `metro.config.js`, `global.css`, `tailwind.config.js`, and `nativewind-env.d.ts` wire Tailwind → RN. Dark, arcade-forward palette uses `ink` / `neon` tokens.

---

## Phase 2 roadmap (gameplay & multiplayer)

1. **Authoritative match service** — persist `match_sessions` from matchmaking; server-validated scores; anti-tamper.
2. **Gameplay engine** — replace `GameplayPlaceholder` with RN game loop (e.g. Reanimated/Gesture Handler + fixed tick); deterministic simulation or server relay.
3. **Networking** — WebRTC/data channel or dedicated game server; reconcile latency and pause.
4. **Economic integrity** — move joins, purchases, and rewards into transactional RPC / Edge Functions only.
5. **Anti-cheat** — client hints + server replay verification; hook `suspicious_flag`, `verification_status`, `reports`.
6. **Stripe** — hosted billing + webhooks → `syncSubscriptionStatus`; never expose secret keys client-side.

---

## Project tree (abbrev.)

```
KickClash/
├── app/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── (auth)/          # sign-in, sign-up, onboarding, forgot-password
│   └── (app)/(tabs)/    # Home, tournaments/*, play/*, leaderboard, profile/*
├── components/ui/
├── features/
├── hooks/
├── lib/
├── providers/
├── services/api/
├── services/matchmaking/
├── store/
├── supabase/
│   ├── client.ts
│   └── functions/      # Edge stubs + _shared
├── sql/
│   ├── migrations/
│   └── seed/
├── types/
├── utils/ + __tests__/
├── global.css
├── tailwind.config.js
├── metro.config.js
├── babel.config.js
├── app.json
├── .env.example
└── README.md
```

---

## Troubleshooting

- **RLS errors on insert:** ensure the user is authenticated, policies match your workflow, or use Edge Functions with the service role for admin-only writes.
- **`execute function` trigger errors:** project must be PostgreSQL 14+ (Supabase default). Older local Postgres may need `EXECUTE PROCEDURE` syntax instead — adjust migrations accordingly.
- **Sign-up blocked:** configure Supabase Auth (email confirmations, redirect URLs) and ensure the `handle_new_user` trigger ran after migrations.

---

## License

Private / your org — adjust as needed.
