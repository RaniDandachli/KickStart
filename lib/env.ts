import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().default('https://placeholder.supabase.co'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional().default('placeholder-anon-key'),
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  EXPO_PUBLIC_ENABLE_REALTIME: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_ENABLE_REALTIME: process.env.EXPO_PUBLIC_ENABLE_REALTIME ?? 'false',
});
