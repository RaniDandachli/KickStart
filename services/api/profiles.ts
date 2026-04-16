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
  Pick<
    ProfileRow,
    'username' | 'display_name' | 'region' | 'avatar_url' | 'shipping_address' | 'country_code'
  >
>;

export async function updateProfileFields(userId: string, patch: ProfileUpdatePatch): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/**
 * Upload a local image URI to Supabase Storage and return the public URL.
 * Expects bucket `avatars` and policies from supabase/migrations/00004_storage_avatars.sql
 */
export async function uploadProfileAvatarFromUri(userId: string, localUri: string): Promise<string> {
  const supabase = getSupabase();
  const lower = localUri.toLowerCase();
  const isPng = lower.includes('png') || lower.endsWith('.png');
  const path = `${userId}/avatar.${isPng ? 'png' : 'jpg'}`;
  const contentType = isPng ? 'image/png' : 'image/jpeg';

  const res = await fetch(localUri);
  const blob = await res.blob();
  const uploadContentType = blob.type && blob.type.startsWith('image/') ? blob.type : contentType;

  const { error: upErr } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: uploadContentType,
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

export type UserAchievementRow = {
  id: string;
  earned_at: string;
  name: string;
  description: string | null;
  icon_key: string | null;
};

/** Earned badges with catalog copy — for profile / achievements UI. */
export async function fetchUserAchievements(userId: string): Promise<UserAchievementRow[]> {
  const supabase = getSupabase();
  const { data: earned, error: e1 } = await supabase
    .from('user_achievements')
    .select('id, earned_at, achievement_id')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  if (e1) throw e1;
  const rows = earned ?? [];
  if (rows.length === 0) return [];
  const achIds = [...new Set(rows.map((r) => r.achievement_id as string))];
  const { data: catalog, error: e2 } = await supabase
    .from('achievements')
    .select('id, name, description, icon_key')
    .in('id', achIds);
  if (e2) throw e2;
  const byId = new Map((catalog ?? []).map((a) => [a.id as string, a]));
  return rows.map((r) => {
    const a = byId.get(r.achievement_id as string);
    return {
      id: r.id as string,
      earned_at: r.earned_at as string,
      name: (a?.name as string) ?? 'Achievement',
      description: (a?.description as string | null) ?? null,
      icon_key: (a?.icon_key as string | null) ?? null,
    };
  });
}
