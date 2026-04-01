import { z } from 'zod';

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
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_ENABLE_BACKEND: process.env.EXPO_PUBLIC_ENABLE_BACKEND,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED: process.env.EXPO_PUBLIC_WALLET_TOPUP_STRIPE_ENABLED,
  EXPO_PUBLIC_ENABLE_REALTIME: process.env.EXPO_PUBLIC_ENABLE_REALTIME ?? 'false',
});
