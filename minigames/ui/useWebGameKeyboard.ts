import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Default keys to `preventDefault` so the page doesn’t scroll / change focus while playing. */
export const WEB_GAME_PREVENT_DEFAULT_KEYS: readonly string[] = [
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'KeyX',
  'Enter',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
];

/**
 * Maps browser `KeyboardEvent.code` values to handlers (keydown = true, keyup = false).
 * Only runs on web — no-op on iOS/Android. Use for Expo web / laptop play (Space, arrows, etc.).
 */
export function useWebGameKeyboard(
  enabled: boolean,
  handlers: Partial<Record<string, (down: boolean) => void>>,
  options?: {
    /** Skip keydown repeat (holding key) — good for jump/flap. Default true. */
    ignoreRepeat?: boolean;
    /** Key codes to call preventDefault on (stops page scroll for Space, etc.). */
    preventDefaultOn?: readonly string[];
  },
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const ignoreRepeat = options?.ignoreRepeat !== false;
  const preventOn = useRef<Set<string>>(new Set(WEB_GAME_PREVENT_DEFAULT_KEYS));
  preventOn.current = new Set(options?.preventDefaultOn ?? WEB_GAME_PREVENT_DEFAULT_KEYS);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!enabled) return;

    const onDown = (e: KeyboardEvent) => {
      const fn = handlersRef.current[e.code];
      if (!fn) return;
      if (ignoreRepeat && e.repeat) return;
      fn(true);
      if (preventOn.current.has(e.code)) e.preventDefault();
    };

    const onUp = (e: KeyboardEvent) => {
      const fn = handlersRef.current[e.code];
      if (!fn) return;
      fn(false);
      if (preventOn.current.has(e.code)) e.preventDefault();
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [enabled, ignoreRepeat]);
}
