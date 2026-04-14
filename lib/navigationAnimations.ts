import { Platform } from 'react-native';

/**
 * Shared native-stack options for Expo Router `Stack` layouts.
 * Keeps tab flows (Arcade, Events) feeling consistent across platforms.
 */
export const stackAnimationDefaults = {
  /** iOS uses native default; Android gets an explicit slide. Web falls back to stack default. */
  ...(Platform.OS !== 'web'
    ? {
        animation: Platform.OS === 'ios' ? ('default' as const) : ('slide_from_right' as const),
        gestureEnabled: true as const,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true as const } : {}),
      }
    : {}),
} as const;

/** Softer handoff after gameplay (match → result). */
export const fadeReplaceStackOptions = {
  ...(Platform.OS !== 'web' ? { animation: 'fade' as const, gestureEnabled: true as const } : {}),
};
