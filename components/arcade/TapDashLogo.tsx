import { View, type StyleProp, type ViewStyle } from 'react-native';

import { TapDashGameIcon } from '@/components/arcade/MinigameIcons';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Round clipping (good for row icons). */
  rounded?: boolean;
};

/** Tap Dash mark — vector neon orb + gate (replaces raster marketing asset in UI). */
export function TapDashLogo({ size = 40, style, rounded = true }: Props) {
  const r = rounded ? Math.min(size * 0.22, 12) : 0;
  return (
    <View style={[{ width: size, height: size, borderRadius: r, overflow: 'hidden' }, style]}>
      <TapDashGameIcon size={size} />
    </View>
  );
}
