import { z } from 'zod';

/** Empty string in .env → treat as unset (optional UUID for dev opponent). */
const optionalUuidFromEnv = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().uuid().optional(),
);

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().default('https://placeholder.supabase.co'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().default('placeholder-anon-key'),
  /** When true, use Supabase auth + API; when false, guest/demo mode (see `constants/featureFlags.ts`). */
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
});
