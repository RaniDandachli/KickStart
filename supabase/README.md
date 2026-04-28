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

**Withdrawal platform fee:** Not an Expo or Edge secret — set **`platform_economy.withdraw_platform_fee_bps`** (0–9999 basis points; e.g. `250` = 2.50%) via SQL (`UPDATE … WHERE id = 1`). Migration **`00055_platform_economy_withdraw_fee_bps.sql`** adds the column and **`get_withdraw_platform_fee_bps`** for authenticated previews; **`withdrawWalletToConnect`** / **`withdrawWalletToWhop`** load the same value server-side.

## Edge Functions — secrets (hosted)

Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for deployed functions. For anything else:

**Dashboard → Project Settings → Edge Functions → Secrets**

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe-powered functions: `stripeWebhook`, `createWalletCheckoutSession`, `createWalletPaymentIntent`, `createStripeConnectLink`, `getStripeConnectAccount`, `withdrawWalletToConnect`, and `syncSubscriptionStatus` (test `sk_test_…`, then live `sk_live_…`) |
| `WHOP_COMPANY_API_KEY` | `createWhopPayoutPortalLink` — Company API key from [Whop developer dashboard](https://whop.com/dashboard/developer) (platform / connected accounts) |
| `WHOP_PARENT_COMPANY_ID` | `createWhopPayoutPortalLink`, `withdrawWalletToWhop` — Your platform Whop company id (`biz_…`): parent for connected accounts and **origin** for ledger transfers |

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
npx supabase functions deploy createStripeConnectLink getStripeConnectAccount withdrawWalletToConnect createWhopPayoutPortalLink withdrawWalletToWhop
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

### Whop (connected accounts + hosted payout portal)

1. Set **`WHOP_COMPANY_API_KEY`** and **`WHOP_PARENT_COMPANY_ID`** (your platform `biz_…` id) in Edge secrets.
2. Deploy: `npx supabase functions deploy createWhopPayoutPortalLink withdrawWalletToWhop`
3. Apply migration **`00040_profiles_whop_company_id.sql`** so `profiles.whop_company_id` exists.
4. Return URLs are built like Stripe (`EXPO_PUBLIC_WHOP_PAYOUT_REDIRECT_BASE_URL` or `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL`) with path **`profile/whop-payouts`**. Whop requires publicly reachable `https://` URLs for the hosted portal — use your production domain or a tunnel in dev.
5. Grant the Company API key **`payout:transfer_funds`** (Whop Dashboard → API key permissions) for withdrawals.

**Withdrawals to Whop:** `withdrawWalletToWhop` moves USD from the user’s **in-app** `wallet_cents` to their **connected** Whop company via `POST /transfers` (`origin_id` = platform, `destination_id` = user’s `whop_company_id`). The API key needs **`payout:transfer_funds`**, and your **platform Whop balance** must cover the transfer ([top up](https://docs.whop.com/developer/platforms/add-funds-to-your-balance) if needed). Users still cash out to their bank through Whop’s payout portal.

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

## H2H queue maintenance + “open queue” push alerts

Edge functions involved: **`h2hOpenMatchWatchScan`** (finds watchers + sends Expo + web push), **`triggerOpenMatchWatchScan`** (authenticated relay from the app — calls the scan with the server secret), **`h2hMaintenance`** (expires stale queue rows, then calls the scan).

**App flow:** When a signed-in user successfully enters the waiting queue, the client calls **`triggerOpenMatchWatchScan`**, which runs the same scan as maintenance/webhooks. You can still add a **Database Webhook** as backup or for redundancy.

### Deploy these functions (run in your project folder)

Individual deploys (what you asked for):

```bash
npx supabase functions deploy h2hMaintenance
npx supabase functions deploy h2hOpenMatchWatchScan
npx supabase functions deploy triggerOpenMatchWatchScan
```

Or use npm scripts:

```bash
npm run functions:deploy:h2hMaintenance
npm run functions:deploy:h2hOpenMatchWatchScan
npm run functions:deploy:triggerOpenMatchWatchScan
```

Full H2H bundle (match session + maintenance + web push register):

```bash
npm run functions:deploy:match
```

### 1) Secrets (Dashboard → Edge Functions → Secrets)

- **`H2H_MAINTENANCE_SECRET`** — long random string; you will paste the **same** value into the Database Webhook header below as **`x-h2h-maintenance-secret`**.

**Two different push systems (do not mix them):**

| Channel | Where it runs | What you configure |
|--------|----------------|-------------------|
| **Native** (Expo app on iOS/Android) | Apple / Google receive the notification via **Expo’s push service** | Edge secret **`EXPO_ACCESS_TOKEN`** from [expo.dev](https://expo.dev) → Access tokens. Users get **`expo_push_token`** on device. **Not used for browser.** |
| **Web** (Safari / Chrome on your site) | Browser **Web Push** (standard HTTPS + service worker) | Edge secrets **`WEB_PUSH_VAPID_PUBLIC_KEY`** + **`WEB_PUSH_VAPID_PRIVATE_KEY`** (a **VAPID** key pair — see below). App env **`EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`** = the **public** key only. **No Expo access token for web.** |

**What is VAPID?** Browsers require the server to prove who is sending push notifications. **VAPID** (“Voluntary Application Server Identification”) is a **public/private key pair** you generate once (e.g. `npx web-push generate-vapid-keys`). The **public** key is shared with the browser when the user subscribes; the **private** key stays in Supabase Edge and signs each web push. It is **not** an Expo product — it is the standard way to send web pushes.

- **`EXPO_ACCESS_TOKEN`** — **native pushes only** (Expo iOS/Android).
- **`WEB_PUSH_VAPID_PUBLIC_KEY`**, **`WEB_PUSH_VAPID_PRIVATE_KEY`**, optional **`WEB_PUSH_CONTACT`**, optional **`WEB_PUSH_PUBLIC_ORIGIN`** — **web pushes only** (see Web Push subsection below).

### 2) Automatic pushes when someone joins the queue (no curl — Dashboard only)

This wires **Postgres → HTTP** so each time a row is written to the queue, Supabase POSTs to your scan function and matching users get notified.

1. In **Supabase Dashboard**, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcdxyzcompany.supabase.co`)
   - **anon public** key (long `eyJ…` string)
2. **Database → Webhooks** → **Create a new hook**.
3. **Name:** e.g. `h2h-queue-open-match-scan`
4. **Table:** `public.h2h_queue_entries`
5. **Events:** enable **Insert** (and **Update** too if your app sometimes sets `status = waiting` on an existing row).
6. **Type:** HTTP Request
7. **Method:** POST
8. **URL:**  
   `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/h2hOpenMatchWatchScan`  
   (same host as Project URL; path must be exactly `/functions/v1/h2hOpenMatchWatchScan`)
9. **HTTP Headers** — add these rows (values from step 1 and from **`H2H_MAINTENANCE_SECRET`**):

| Header name | Value |
|-------------|--------|
| `apikey` | Paste the **anon public** key |
| `Authorization` | `Bearer ` + paste the **same anon key** (literally the word Bearer, space, then the key) |
| `Content-Type` | `application/json` |
| `x-h2h-maintenance-secret` | Exact same string as Edge secret **`H2H_MAINTENANCE_SECRET`** |

10. Save. Queue a test match (or insert a waiting row): **Edge Functions → `h2hOpenMatchWatchScan` → Logs** should show `[h2hOpenMatchWatchScan] start` and a JSON result.

**Note:** The scan checks all current waiters and all users with **Open match alerts** on; duplicates are prevented by **`h2h_open_slot_notify_log`**.

### 3) Optional: stale queue cleanup (`h2hMaintenance`)

`h2hMaintenance` expires old stale rows and then calls the scan again. If you only use the webhook above, pushes still work; maintenance is mainly for cleanup. Schedule it with **`pg_cron` + `pg_net`** using **`supabase/scripts/schedule-h2h-maintenance.example.sql`** and the same **`apikey` / Authorization / x-h2h-maintenance-secret** pattern, or call it manually when needed.

### 4) Optional: manual tests (curl)

If you ever need to test from a terminal:

```bash
# Replace PROJECT_REF, keys, and secret.
curl -sS -X POST "https://PROJECT_REF.supabase.co/functions/v1/h2hMaintenance" \
  -H "apikey: YOUR_ANON_OR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_ANON_OR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "x-h2h-maintenance-secret: YOUR_H2H_MAINTENANCE_SECRET" \
  -d "{}"
```

```bash
curl -sS -X POST "https://PROJECT_REF.supabase.co/functions/v1/h2hOpenMatchWatchScan" \
  -H "apikey: YOUR_ANON_OR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_ANON_OR_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "x-h2h-maintenance-secret: YOUR_H2H_MAINTENANCE_SECRET" \
  -d "{}"
```

After deploy, **Edge Functions → Logs** for **`h2hMaintenance`** and **`h2hOpenMatchWatchScan`** should show lines like `[h2hMaintenance] POST`, `[h2hOpenMatchWatchScan] start`, and either `no waiting queue rows` or `done {…}`.

### Web Push (browser — YouTube / other tabs)

1. Apply migration **`00042_web_push_subscriptions.sql`**.
2. Generate VAPID keys: `npx web-push generate-vapid-keys` (install `web-push` globally or `npx web-push …`).
3. **Edge secrets**: `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, optional `WEB_PUSH_CONTACT` (`mailto:…`), optional **`WEB_PUSH_PUBLIC_ORIGIN`** (e.g. `https://your-site.com` — used to build the URL opened when the user taps the notification; defaults to `https://runitarcade.app`).
4. **Web app env** (Cloudflare / build): **`EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY`** = same **public** key as in Edge (not the private key). Rebuild the static site so `public/sw.js` is served at **`/sw.js`** (HTTPS required except localhost).
5. Users: turn on **Open match alerts** in Settings or **Ping me for open queues** on the match screen, allow the browser notification prompt.

## App configuration

In the Expo app `.env`, set `EXPO_PUBLIC_ENABLE_BACKEND=true` when the database and functions are ready. The client calls Edge Functions with the anon key (`apikey` header) plus the user access token (`Authorization: Bearer <jwt>`). You do **not** mint JWTs yourself — Supabase Auth issues them at sign-in. Use the same project URL and anon key in the app as in this Supabase project.

### “JWT required” / gateway auth errors

Hosted projects may enforce **JWT verification at the API gateway** (`verify_jwt`). If you see generic JWT errors even while signed in, ensure `supabase/config.toml` sets `verify_jwt = false` for functions that already validate the user inside the handler (`auth.getUser()`), then redeploy those functions so the dashboard picks up the setting:

```bash
npx supabase functions deploy submitMinigameScore
npx supabase functions deploy redeem-gift-card
npx supabase functions deploy notifyDailyCreditsPush
# …and any other function you changed in config.toml
```

Also check **Dashboard → Edge Functions → [function] → Settings** and turn off “Enforce JWT verification” if it overrides the CLI for that function.

## Welcome email (`sendWelcomeEmail`)

Sends a Resend welcome message when a new row is inserted into `public.profiles` (same moment as auth signup via `handle_new_user`).

1. Deploy: `npm run functions:deploy:welcome` (or `npx supabase functions deploy sendWelcomeEmail`).
2. **Secrets** (Dashboard → Edge Functions → Secrets): same Resend vars as gift cards (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, optional `SUPPORT_EMAIL`, `BRAND_NAME`, `EMAIL_SUBJECT_WELCOME`) plus **`WELCOME_EMAIL_WEBHOOK_SECRET`** — use a long random string.
3. **Database Webhook**: Dashboard → **Database** → **Webhooks** → **Create a new hook**. Table `profiles`, event **Insert**, method **POST**, URL `https://<project-ref>.supabase.co/functions/v1/sendWelcomeEmail`. Under **HTTP Headers**, add **`Authorization`** with value **`Bearer <your WELCOME_EMAIL_WEBHOOK_SECRET>`** (must match the secret exactly).

The function rejects requests without the correct Bearer token. Resend sends use an idempotency key per user id so webhook retries do not double-email.

## Stripe test → live

1. Use **test** keys (`pk_test_` / `sk_test_`) in app env and Edge secrets; verify flows.
2. Switch to **live** keys (`pk_live_` / `sk_live_`) in Dashboard secrets and app publishable key; rotate webhook endpoints if you add Stripe webhooks later.
