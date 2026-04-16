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
| `STRIPE_SECRET_KEY` | Stripe-powered functions: `stripeWebhook`, `createWalletCheckoutSession`, `createWalletPaymentIntent`, `createStripeConnectLink`, `getStripeConnectAccount`, `withdrawWalletToConnect`, and `syncSubscriptionStatus` (test `sk_test_…`, then live `sk_live_…`) |

Local testing with secrets file (do not commit):

```bash
cp supabase/.env.functions.example supabase/.env.functions
# Edit supabase/.env.functions — set STRIPE_SECRET_KEY at minimum
```

```bash
npx supabase secrets set --env-file supabase/.env.functions
```

### Stripe Connect (bank onboarding + payouts)

These Edge Functions must be **deployed** and `STRIPE_SECRET_KEY` must be set as a **hosted secret** (see above):

- `createStripeConnectLink` — creates Stripe Express account + Account Link URL (onboarding)
- `getStripeConnectAccount` — reads payouts enabled / dashboard link
- `withdrawWalletToConnect` — sends wallet balance to the user’s connected account

**1. Deploy (from repo root, linked project):**

```bash
npm run functions:deploy:stripe
```

Or only Connect-related functions:

```bash
npx supabase functions deploy createStripeConnectLink getStripeConnectAccount withdrawWalletToConnect
```

**2. Stripe Dashboard — allow return / refresh URLs**

The app sends `refresh_url` and `return_url` built from Expo Linking, e.g.:

- **Custom scheme (production builds):** `runit://profile/stripe-connect?connect=refresh` and `runit://profile/stripe-connect?connect=return` (see `app.json` → `scheme`: `runit`)
- **Expo Go / dev:** URLs look like `exp://<your-lan-ip>:8081/--/profile/stripe-connect?connect=return` — the host/port change when Metro changes

In **Stripe Dashboard → Connect → Settings** (wording can vary slightly), open **Redirect URIs**, **Return URLs**, or **Onboarding** / **Integration** settings for Connect and add:

- Your **`runit://`** URLs for the path `profile/stripe-connect` (with query `connect=refresh` and `connect=return` if the dashboard requires exact URLs; otherwise add the base path your Stripe project allows).
- For local testing, add the **exact** `exp://…` or `https://…` URLs Metro prints when you open the Connect screen once, or use a stable tunnel URL if you use one.

If Account Link creation fails with an invalid URL error, copy the `refreshUrl` / `returnUrl` from the function logs or temporarily log them in `createStripeConnectLink`, then whitelist those strings in Stripe.

**3. Connect platform:** Ensure **Connect** is enabled for your Stripe platform account (Standard/Express as you prefer; this codebase uses **Express** accounts in `createStripeConnectLink`).

If `createStripeConnectLink` returns *“You can only create new accounts if you've signed up for Connect”*, the **platform** has not finished **Connect** onboarding in Stripe: open **[dashboard.stripe.com/connect](https://dashboard.stripe.com/connect)** (use **Test mode** while developing), complete agreements and any required business profile steps, then retry. Your **Supabase secret** must use a key from the **same** Stripe mode (e.g. `sk_test_…` with Test mode Connect, `sk_live_…` with Live mode Connect).

The `Deno.core.runMicrotasks() is not supported` log line can appear after errors in Edge Functions; it is usually harmless. If it persists on every invoke, update the Supabase CLI or check Supabase status.

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

## Welcome email (`sendWelcomeEmail`)

Sends a Resend welcome message when a new row is inserted into `public.profiles` (same moment as auth signup via `handle_new_user`).

1. Deploy: `npm run functions:deploy:welcome` (or `npx supabase functions deploy sendWelcomeEmail`).
2. **Secrets** (Dashboard → Edge Functions → Secrets): same Resend vars as gift cards (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `SUPPORT_EMAIL`, `BRAND_NAME`, `EMAIL_SUBJECT_WELCOME`) plus **`WELCOME_EMAIL_WEBHOOK_SECRET`** — use a long random string.
3. **Database Webhook**: Dashboard → **Database** → **Webhooks** → **Create a new hook**. Table `profiles`, event **Insert**, method **POST**, URL `https://<project-ref>.supabase.co/functions/v1/sendWelcomeEmail`. Under **HTTP Headers**, add **`Authorization`** with value **`Bearer <your WELCOME_EMAIL_WEBHOOK_SECRET>`** (must match the secret exactly).

The function rejects requests without the correct Bearer token. Resend sends use an idempotency key per user id so webhook retries do not double-email.

## Stripe test → live

1. Use **test** keys (`pk_test_` / `sk_test_`) in app env and Edge secrets; verify flows.
2. Switch to **live** keys (`pk_live_` / `sk_live_`) in Dashboard secrets and app publishable key; rotate webhook endpoints if you add Stripe webhooks later.
