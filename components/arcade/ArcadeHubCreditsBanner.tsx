import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { runit, runitFont, runitGlowPinkSoft, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type Props = {
  creditsFormatted: string;
  onAddPress: () => void;
  onHowItWorks: () => void;
  onEarnInfo?: () => void;
  onRedeemPrizes?: () => void;
};

export function ArcadeHubCreditsBanner({
  creditsFormatted,
  onAddPress,
  onHowItWorks,
  onEarnInfo,
  onRedeemPrizes,
}: Props) {
  return (
    <LinearGradient
      colors={['rgba(109,40,217,0.95)', 'rgba(76,29,149,0.88)', 'rgba(49,46,129,0.92)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.outer, runitGlowPinkSoft]}
    >
      <View style={styles.inner}>
        <View style={styles.coinRing}>
          <Text style={styles.crown}>👑</Text>
        </View>
        <View style={styles.balanceCol}>
          <Text style={styles.kicker}>ARCADE CREDITS</Text>
          <Text style={[styles.amount, { fontFamily: runitFont.black }, runitTextGlowPink]} numberOfLines={1}>
            {creditsFormatted}
          </Text>
        </View>
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel="Add arcade credits"
          style={({ pressed }) => [styles.addSquare, pressed && { opacity: 0.88 }]}
        >
          <Text style={[styles.addPlus, { fontFamily: runitFont.black }]}>+</Text>
        </Pressable>
      </View>
      <View style={styles.footerChips}>
        <FooterChip
          icon="information-circle-outline"
          label="Spend Arcade Credits on runs (about 10–20 per game)"
          onPress={onHowItWorks}
        />
        <FooterChip icon="sparkles-outline" label="Earn tickets" onPress={onEarnInfo ?? onHowItWorks} />
        <FooterChip
          icon="gift-outline"
          label="Redeem in Prizes"
          onPress={onRedeemPrizes ?? onHowItWorks}
        />
        <FooterChip icon="help-circle-outline" label="How Arcade works" onPress={onHowItWorks} />
      </View>
    </LinearGradient>
  );
}

function FooterChip({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof SafeIonicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
    >
      <SafeIonicons name={icon} size={12} color="rgba(253,224,71,0.9)" />
      <Text style={styles.chipTxt} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.55)',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: 'rgba(4,2,12,0.55)',
    gap: 12,
  },
  coinRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(88,28,135,0.95)',
    borderWidth: 2,
    borderColor: 'rgba(253,224,71,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crown: { fontSize: 22 },
  balanceCol: { flex: 1, minWidth: 0 },
  kicker: {
    color: 'rgba(248,250,252,0.88)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  amount: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  addSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(250,204,21,0.2)',
    borderWidth: 2,
    borderColor: runit.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: {
    color: runit.gold,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  footerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: 'rgba(2,0,8,0.45)',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 120,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  chipTxt: {
    flex: 1,
    color: 'rgba(226,232,240,0.92)',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
