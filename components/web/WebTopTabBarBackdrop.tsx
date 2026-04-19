import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';

import { APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

/**
 * Translucent gradient — same hues as the app screen, but lets content behind the bar read through.
 * (Solid gradient reads like an opaque “header slab”; this matches the floating icon-tab look.)
 */
const WEB_TAB_BAR_BACKDROP_COLORS = [
  'rgba(6, 2, 14, 0.42)',
  'rgba(18, 8, 31, 0.36)',
  'rgba(12, 6, 24, 0.34)',
  'rgba(5, 2, 8, 0.4)',
] as const;

/**
 * Web tabs (desktop top strip + narrow / iPhone bottom bar): React Navigation uses an opaque
 * `colors.card` unless `tabBarBackground` is set. Light frosted gradient so icons sit on glass,
 * not a solid dock.
 */
export function WebTopTabBarBackdrop() {
  const glassStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'saturate(140%) blur(14px)',
          WebkitBackdropFilter: 'saturate(140%) blur(14px)',
        } as Record<string, string>)
      : null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, glassStyle]}>
      <LinearGradient
        colors={[...WEB_TAB_BAR_BACKDROP_COLORS]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
