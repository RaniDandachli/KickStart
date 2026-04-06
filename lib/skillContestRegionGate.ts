import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { env } from '@/lib/env';
import { getSupabase } from '@/supabase/client';

export function isSkillContestRegionBlocked(profileRegion: string | null | undefined): boolean {
  if (env.EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES.size === 0) return false;
  const r = (profileRegion ?? '').trim().toUpperCase();
  if (!r) return false;
  return env.EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES.has(r);
}

/** When true, caller should block paid contest entry and show UI (e.g. Alert). */
export async function profileBlocksPaidSkillContest(userId: string): Promise<boolean> {
  if (!ENABLE_BACKEND || userId === 'guest') return false;
  if (env.EXPO_PUBLIC_SKILL_CONTEST_BLOCKED_REGION_CODES.size === 0) return false;
  const { data } = await getSupabase().from('profiles').select('region').eq('id', userId).maybeSingle();
  return isSkillContestRegionBlocked(data?.region);
}
