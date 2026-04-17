import { useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Platform } from 'react-native';

const nativeGesturesUnlocked =
  Platform.OS !== 'web'
    ? {
        gestureEnabled: true as const,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true as const } : {}),
      }
    : null;

const nativeGesturesLocked =
  Platform.OS !== 'web'
    ? {
        gestureEnabled: false as const,
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: false as const } : {}),
      }
    : null;

/**
 * Disables stack interactive pop / iOS full-screen back swipe while `locked` (e.g. active minigame).
 * Restores defaults when unlocked or on unmount.
 */
export function useLockNavigatorGesturesWhile(locked: boolean) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    if (Platform.OS === 'web' || !nativeGesturesLocked || !nativeGesturesUnlocked) return;
    navigation.setOptions(locked ? nativeGesturesLocked : nativeGesturesUnlocked);
    return () => {
      navigation.setOptions(nativeGesturesUnlocked);
    };
  }, [navigation, locked]);
}
