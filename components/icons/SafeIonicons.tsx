import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Platform, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { WebGlyphByIonName } from '@/components/icons/WebGlyphs';

type IonProps = ComponentProps<typeof Ionicons>;

/**
 * On web, Ionicon font often fails in static export — use SVG glyphs. Native keeps vector font.
 */
export function SafeIonicons({
  name,
  size = 24,
  color = '#fff',
  style,
  ...rest
}: IonProps) {
  if (Platform.OS === 'web') {
    return (
      <View style={style as StyleProp<ViewStyle>}>
        <WebGlyphByIonName name={String(name)} size={size} color={String(color)} />
      </View>
    );
  }
  return <Ionicons name={name} size={size} color={color} style={style as StyleProp<TextStyle>} {...rest} />;
}
