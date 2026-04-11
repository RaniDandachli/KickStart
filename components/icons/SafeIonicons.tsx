import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Platform, type StyleProp, type TextStyle } from 'react-native';

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
    return <WebGlyphByIonName name={String(name)} size={size} color={String(color)} />;
  }
  return <Ionicons name={name} size={size} color={color} style={style as StyleProp<TextStyle>} {...rest} />;
}
