# Supabase (CLI + Edge Functions)

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm i -D supabase` or use `npx supabase`.
- Log in: `npx supabase login`
- Link this repo to your hosted project: `npx supabase link --project-ref <your-project-ref>`

## Auth (skip email confirmation in dev)

By default Supabase requires **Confirm email** before sign-in. For quick testing:

**Dashboard → Authentication → Providers → Email** — disable **Confirm email** (or **Confirm sign up** wording in newer dashboards).

Then new sign-ups receive a session immediately and the app routes straight into the app. Turn confirmations back on before production if you want verified emails.

## Database migrations

Versioned SQL lives in **`supabase/migrations/`** (same files may appear under `sql/migrations` on your machine if you use a directory link).

Apply to the hosted database:

1. **Dashboard → SQL Editor** — run each file in numeric order, **or**
2. **`npx supabase db push`** — after `supabase link`, applies `supabase/migrations/*.sql`.

Optional reference data: `sql/seed/*.sql` (run manually in SQL Editor).

## Edge Functions — secrets (hosted)

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for deployed functions. For anything else:

**Dashboard → Project Settings → Edge Functions → Secrets**

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | `syncSubscriptionStatus` (test `sk_test_…`, then live `sk_live_…`) |

Local testing with secrets file (do not commit):

```bash
# supabase/.env.functions (gitignored — create locally)
STRIPE_SECRET_KEY=sk_test_...
```

```bash
npx supabase secrets set --env-file supabase/.env.functions
```

## Deploy all functions

```bash
npx supabase functions deploy
```

Deploy one function:

```bash
npx supabase functions deploy submitMinigameScore
```

## Local serve (optional)

Requires Docker for full local stack, or serve functions against the **hosted** project:

```bash
npx supabase functions serve --env-file supabase/.env.functions
```

Invoke locally (example):

```bash
curl -i --location --request POST "http://127.0.0.1:54321/functions/v1/submitMinigameScore" \
  --header "Authorization: Bearer <user_jwt>" \
  --header "Content-Type: application/json" \
  --data '{"game_type":"tap_dash","score":10,"duration_ms":60000,"taps":12}'
```

## App configuration

In the Expo app `.env`, set `EXPO_PUBLIC_ENABLE_BACKEND=true` when the database and functions are ready. The client calls functions with `supabase.functions.invoke(...)` using the anon key + user session; no service role in the app.

## Stripe test → live

1. Use **test** keys (`pk_test_` / `sk_test_`) in app env and Edge secrets; verify flows.
2. Switch to **live** keys (`pk_live_` / `sk_live_`) in Dashboard secrets and app publishable key; rotate webhook endpoints if you add Stripe webhooks later.
