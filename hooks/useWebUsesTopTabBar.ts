import { useWindowDimensions, Platform } from 'react-native';

import { WEB_TAB_DESKTOP_MIN_WIDTH } from '@/minigames/ui/minigameWebMaxWidth';

/**
 * Desktop-width web uses the top tab bar; narrow web (e.g. iPhone Safari) uses bottom tabs like the iOS app.
 */
export function useWebUsesTopTabBar(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_TAB_DESKTOP_MIN_WIDTH;
}
