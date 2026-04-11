import { Audio } from 'expo-av';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const DASH_DUEL_BGM = require('@/assets/sounds/dash-duel-neon-velocity.mp3');

/**
 * Loops "Neon Velocity" while the Dash Duel screen is focused (menu → run → results).
 * Unloads on blur so global lobby music can resume when you leave.
 */
export function useDashDuelNeonVelocityMusic(): void {
  const soundRef = useRef<Audio.Sound | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
        } catch {
          /* ignore */
        }
        try {
          const { sound } = await Audio.Sound.createAsync(DASH_DUEL_BGM, {
            isLooping: true,
            volume: 0.46,
            shouldPlay: false,
          });
          if (cancelled) {
            await sound.unloadAsync();
            return;
          }
          soundRef.current = sound;
          await sound.playAsync();
        } catch (e) {
          if (__DEV__) console.warn('[DashDuelMusic] load failed', e);
        }
      })();
      return () => {
        cancelled = true;
        const s = soundRef.current;
        soundRef.current = null;
        void s?.unloadAsync();
      };
    }, []),
  );
}
