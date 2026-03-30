import type { ProfileRow } from '@/types/database';
import { getSupabase } from '@/supabase/client';

export const PROFILE_AVATAR_BUCKET = 'avatars';

export async function fetchProfileById(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export type ProfileUpdatePatch = Partial<
  Pick<ProfileRow, 'username' | 'display_name' | 'region' | 'avatar_url' | 'shipping_address'>
>;

export async function updateProfileFields(userId: string, patch: ProfileUpdatePatch): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/**
 * Upload a local image URI to Supabase Storage and return the public URL.
 * Expects bucket `avatars` and policies from sql/migrations/00005_storage_avatars.sql
 */
export async function uploadProfileAvatarFromUri(userId: string, localUri: string): Promise<string> {
  const supabase = getSupabase();
  const lower = localUri.toLowerCase();
  const isPng = lower.includes('png') || lower.endsWith('.png');
  const path = `${userId}/avatar.${isPng ? 'png' : 'jpg'}`;
  const contentType = isPng ? 'image/png' : 'image/jpeg';

  const res = await fetch(localUri);
  const blob = await res.blob();

  const { error: upErr } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(PROFILE_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Normalize username: lowercase, allowed chars only. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'Use at least 3 characters';
  if (username.length > 20) return 'Max 20 characters';
  if (!/^[a-z0-9_]+$/.test(username)) return 'Letters, numbers, and underscores only';
  return null;
}
