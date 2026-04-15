import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@kickclash/last_minigame_submit_attempt_v1';

export type LastMinigameAttempt = {
  game_type: string;
  score: number;
  duration_ms: number;
  taps: number;
  savedAt: number;
  errorMessage?: string;
};

export async function saveLastMinigameAttempt(attempt: Omit<LastMinigameAttempt, 'savedAt'> & { savedAt?: number }): Promise<void> {
  const payload: LastMinigameAttempt = {
    ...attempt,
    savedAt: attempt.savedAt ?? Date.now(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}

export async function loadLastMinigameAttempt(): Promise<LastMinigameAttempt | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastMinigameAttempt;
  } catch {
    return null;
  }
}

export async function clearLastMinigameAttempt(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
