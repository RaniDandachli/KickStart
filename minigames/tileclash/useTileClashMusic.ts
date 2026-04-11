import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';

const BGM = require('@/assets/sounds/tile-clash-bgm.wav');

/**
 * Loops an upbeat chiptune-style track while the round is active (e.g. solo `phase === 'playing'`,
 * or vs-AI during countdown + match). Stops when false; unloads on unmount.
 * Original procedural asset — see `scripts/generate-tile-clash-bgm.mjs`.
 */
export function useTileClashMusic(isPlaying: boolean): void {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
        const { sound } = await Audio.Sound.createAsync(BGM, {
          isLooping: true,
          volume: 0.44,
          shouldPlay: false,
        });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setReady(true);
      } catch (e) {
        if (__DEV__) console.warn('[TileClashMusic] load failed', e);
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      const s = soundRef.current;
      soundRef.current = null;
      void s?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const s = soundRef.current;
    if (!s) return;

    void (async () => {
      try {
        const st = await s.getStatusAsync();
        if (!st.isLoaded) return;
        if (isPlaying) {
          await s.setPositionAsync(0);
          await s.playAsync();
        } else {
          await s.stopAsync();
          await s.setPositionAsync(0);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [isPlaying, ready]);
}
