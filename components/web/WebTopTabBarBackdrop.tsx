import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { APP_SCREEN_GRADIENT_COLORS, APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

/**
 * Web tabs (desktop top strip + narrow / iPhone bottom bar): React Navigation uses an opaque
 * `colors.card` unless `tabBarBackground` is set. This fills the bar with the same gradient as
 * {@link Screen} so chrome matches the page instead of a separate slab.
 */
export function WebTopTabBarBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[...APP_SCREEN_GRADIENT_COLORS]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
