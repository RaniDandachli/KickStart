import { z } from 'zod';

/** Empty string in .env → treat as unset (optional UUID for dev opponent). */
const optionalUuidFromEnv = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().uuid().optional(),
);

const optionalUrlFromEnv = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().url().optional(),
);

/** Email or `https://…` help URL — used for Support entry points. */
const optionalSupportContactFromEnv = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().min(3).optional(),
);

/** Comma-separated profile `region` codes (e.g. NY,NJ) that cannot start paid skill contests. */
const blockedSkillContestRegionsFromEnv = z.preprocess(
  (v) => (typeof v === 'string' ? v : ''),
  z.string().transform((s) => new Set(s.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean))),
);

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().default('https://placeholder.supabase.co'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().default('placeholder-anon-key'),
  /** When true, use Supabase auth + API. Defaults to true so H2H and wallet are always live unless explicitly disabled. */
  EXPO_PUBLIC_ENABLE_BACKEND: z
    .string()
    .optional()
    .default('true')
    .transform((v) => v.trim().toLowerCase() !== 'false'),
  /** Whop hosted checkout (Edge `createWhopCheckoutSession` + `whopWebhook`). */
  EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v.trim().toLowerCase() === 'true'),
  EXPO_PUBLIC_ENABLE_REALTIME: z
    .string()
    .optional()
    .transform((v) => (v == null ? false : v.trim().toLowerCase() === 'true')),
  /** Second Supabase Auth user id for mock H2H when `ENABLE_BACKEND` (create user in Dashboard, paste UUID). */
  EXPO_PUBLIC_DEV_OPPONENT_USER_ID: optionalUuidFromEnv,
  EXPO_PUBLIC_TERMS_URL: optionalUrlFromEnv,
  EXPO_PUBLIC_PRIVACY_URL: optionalUrlFromEnv,
  EXPO_PUBLIC_SUPPORT_CONTACT: optionalSupportContactFromEnv,
  EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES: blockedSkillContestRegionsFromEnv,
  /** Expo project UUID for `getExpoPushTokenAsync` (Dashboard → Project settings, or app.json `extra.eas.projectId`). */
  EXPO_PUBLIC_EXPO_PROJECT_ID: z.string().optional().default(''),
  /** Public HTTPS origin for checkout redirects & universal links (legacy env name). Defaults to https://runitarcade.app */
  EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL: optionalUrlFromEnv,
  /** Optional public HTTPS origin for Whop payout portal return/refresh (see `lib/whopConnectUrls.ts`). Falls back to `EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL` / runitarcade.app */
  EXPO_PUBLIC_WHOP_PAYOUT_REDIRECT_BASE_URL: optionalUrlFromEnv,
  /** Web Push VAPID public key (URL-safe base64) — pair with Edge secrets WEB_PUSH_VAPID_* for open-queue browser notifications. */
  EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: z.string().optional().default(''),
  /** Optional `tournaments.id` for the Friday $10 → $70 live 8-player cup (join + bracket from Supabase). */
  EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID: optionalUuidFromEnv,
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_ENABLE_BACKEND: process.env.EXPO_PUBLIC_ENABLE_BACKEND,
  EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED: process.env.EXPO_PUBLIC_WHOP_CHECKOUT_ENABLED,
  EXPO_PUBLIC_ENABLE_REALTIME: process.env.EXPO_PUBLIC_ENABLE_REALTIME ?? 'false',
  EXPO_PUBLIC_DEV_OPPONENT_USER_ID: process.env.EXPO_PUBLIC_DEV_OPPONENT_USER_ID,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_SUPPORT_CONTACT: process.env.EXPO_PUBLIC_SUPPORT_CONTACT,
  EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES: process.env.EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES,
  EXPO_PUBLIC_EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
  EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL: process.env.EXPO_PUBLIC_STRIPE_CONNECT_BASE_URL,
  EXPO_PUBLIC_WHOP_PAYOUT_REDIRECT_BASE_URL: process.env.EXPO_PUBLIC_WHOP_PAYOUT_REDIRECT_BASE_URL,
  EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY,
  EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID: process.env.EXPO_PUBLIC_FRIDAY_CUP_TOURNAMENT_ID,
});

/**
 * True when `.env` has real Supabase project values (not template placeholders).
 * Use to warn in dev if `EXPO_PUBLIC_ENABLE_BACKEND=true` but keys were not filled in.
 */
export function isSupabaseLikelyConfigured(): boolean {
  const u = env.EXPO_PUBLIC_SUPABASE_URL;
  const k = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (u.includes('placeholder.supabase.co') || u.includes('YOUR_PROJECT')) return false;
  if (k === 'placeholder-anon-key' || k.includes('your_anon')) return false;
  return k.length >= 32;
}

/** `mailto:` or external https URL for in-app “Support”. */
export function supportContactHref(): string | null {
  const c = env.EXPO_PUBLIC_SUPPORT_CONTACT?.trim();
  if (!c) return null;
  if (/^https?:\/\//i.test(c)) return c;
  return `mailto:${c}`;
}
