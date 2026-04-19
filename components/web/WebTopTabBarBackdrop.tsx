import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';

import { APP_SCREEN_GRADIENT_LOCATIONS } from '@/lib/runitArcadeTheme';

/**
 * Translucent gradient — same hues as the app screen, but lets content behind the bar read through.
 * (Solid gradient reads like an opaque “header slab”; this matches the floating icon-tab look.)
 */
const WEB_TAB_TOP_STRIP_COLORS = [
  'rgba(8, 4, 20, 0.44)',
  'rgba(20, 12, 40, 0.38)',
  'rgba(14, 8, 30, 0.36)',
  'rgba(6, 3, 12, 0.42)',
] as const;

/**
 * iPhone Safari / narrow web: lighter tint so `backdrop-filter` reads as frosted glass (VAZA-style dock).
 */
const WEB_TAB_MOBILE_GLASS_COLORS = [
  'rgba(10, 6, 22, 0.15)',
  'rgba(22, 12, 42, 0.12)',
  'rgba(14, 8, 30, 0.11)',
  'rgba(8, 4, 18, 0.17)',
] as const;

export type WebTabBarBackdropVariant = 'topStrip' | 'mobileBottomGlass';

type Props = {
  /** Desktop top row vs floating iPhone-style bottom pill. */
  variant?: WebTabBarBackdropVariant;
};

/**
 * Web tabs: React Navigation uses an opaque `colors.card` unless `tabBarBackground` is set.
 * Frosted gradient + blur so icons sit on glass, not a solid dock.
 */
export function WebTopTabBarBackdrop({ variant = 'topStrip' }: Props) {
  const isMobileGlass = variant === 'mobileBottomGlass';
  const colors = isMobileGlass ? WEB_TAB_MOBILE_GLASS_COLORS : WEB_TAB_TOP_STRIP_COLORS;

  const glassStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: isMobileGlass
            ? 'saturate(185%) blur(26px)'
            : 'saturate(140%) blur(14px)',
          WebkitBackdropFilter: isMobileGlass
            ? 'saturate(185%) blur(26px)'
            : 'saturate(140%) blur(14px)',
          ...(isMobileGlass
            ? {
                // Helps Safari compose blur + rounded clip cleanly
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
              }
            : {}),
        } as Record<string, string>)
      : null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, glassStyle]}>
      <LinearGradient
        colors={[...colors]}
        locations={[...APP_SCREEN_GRADIENT_LOCATIONS]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {isMobileGlass && Platform.OS === 'web' ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.03)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
