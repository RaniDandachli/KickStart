import { StyleSheet, Text, type TextProps } from 'react-native';

import { runit } from '@/lib/runitArcadeTheme';

type Props = TextProps & {
  children: string;
};

/** Uppercase section kicker — use above cards/lists for clear grouping. */
export function SectionLabel({ style, children, ...rest }: Props) {
  return (
    <Text style={[styles.kicker, style]} {...rest}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  kicker: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: runit.neonPink,
    opacity: 0.92,
  },
});
