import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { AppButton } from '@/components/ui/AppButton';
import { runit, runitFont } from '@/lib/runitArcadeTheme';

type Props = {
  /** Ionicons name, e.g. `people-outline` */
  icon: ComponentProps<typeof SafeIonicons>['name'];
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

/**
 * Friendly empty / zero state: large icon, copy, and one or two CTAs (e.g. add funds + play free).
 */
export function IllustratedEmptyState({
  icon,
  title,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <LinearGradient colors={['rgba(15,23,42,0.85)', 'rgba(30,27,75,0.55)']} style={styles.card}>
      <View style={styles.iconBubble}>
        <SafeIonicons name={icon} size={44} color={runit.neonCyan} />
      </View>
      <Text style={[styles.title, { fontFamily: runitFont.black }]}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
      <AppButton title={primaryLabel} onPress={onPrimary} className="mt-2 w-full" />
      {secondaryLabel && onSecondary ? (
        <AppButton title={secondaryLabel} onPress={onSecondary} variant="ghost" className="mt-2 w-full" />
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.22)',
    alignItems: 'center',
  },
  iconBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  desc: {
    color: 'rgba(203, 213, 225, 0.95)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
});
