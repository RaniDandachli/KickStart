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
  /** When true, use Supabase auth + API; when false, guest mode (see `constants/featureFlags.ts`). */
  EXPO_PUBLIC_ENABLE_BACKEND: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  /** Enable wallet top-up UI when Stripe Checkout is wired server-side. */
  EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  EXPO_PUBLIC_ENABLE_REALTIME: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  /** Second Supabase Auth user id for mock H2H when `ENABLE_BACKEND` (create user in Dashboard, paste UUID). */
  EXPO_PUBLIC_DEV_OPPONENT_USER_ID: optionalUuidFromEnv,
  EXPO_PUBLIC_TERMS_URL: optionalUrlFromEnv,
  EXPO_PUBLIC_PRIVACY_URL: optionalUrlFromEnv,
  EXPO_PUBLIC_SUPPORT_CONTACT: optionalSupportContactFromEnv,
  EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES: blockedSkillContestRegionsFromEnv,
  /** Expo project UUID for `getExpoPushTokenAsync` (Dashboard → Project settings, or app.json `extra.eas.projectId`). */
  EXPO_PUBLIC_EXPO_PROJECT_ID: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_ENABLE_BACKEND: process.env.EXPO_PUBLIC_ENABLE_BACKEND,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED: process.env.EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED,
  EXPO_PUBLIC_ENABLE_REALTIME: process.env.EXPO_PUBLIC_ENABLE_REALTIME ?? 'false',
  EXPO_PUBLIC_DEV_OPPONENT_USER_ID: process.env.EXPO_PUBLIC_DEV_OPPONENT_USER_ID,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
  EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL,
  EXPO_PUBLIC_SUPPORT_CONTACT: process.env.EXPO_PUBLIC_SUPPORT_CONTACT,
  EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES: process.env.EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES,
  EXPO_PUBLIC_EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID,
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
