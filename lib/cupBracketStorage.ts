import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CupBracketPersist } from '@/store/cupBracketStore';

export const CUP_BRACKET_STORAGE_PREFIX = '@kickclash/cup_bracket_v1';

export function cupBracketStorageKey(userId: string, cupId: string): string {
  return `${CUP_BRACKET_STORAGE_PREFIX}/${encodeURIComponent(userId)}/${encodeURIComponent(cupId)}`;
}

/** Read persisted bracket state for list / gating (no zustand). */
export async function loadCupBracketPersist(userId: string, cupId: string): Promise<CupBracketPersist | null> {
  if (!userId || !cupId) return null;
  try {
    const raw = await AsyncStorage.getItem(cupBracketStorageKey(userId, cupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CupBracketPersist;
    if (parsed.cupId !== cupId || typeof parsed.dayKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
