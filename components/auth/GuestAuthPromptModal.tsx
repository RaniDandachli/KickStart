import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openPrivacyPolicy, openTermsOfService } from '@/lib/legalLinks';
import { runitFont } from '@/lib/runitArcadeTheme';

export type GuestAuthPromptVariant =
  | 'wallet'
  | 'arcade_credits'
  | 'play'
  | 'withdraw'
  | 'prizes'
  | 'shipping';

type Copy = {
  title: string;
  subtitle: string;
  tagline: string;
  bullets: string[];
  primaryCta: string;
};

function copyForVariant(v: GuestAuthPromptVariant): Copy {
  const skillBullets = [
    'Enter cash contests and 1v1 skill matches',
    'Add funds securely and track your balance in one place',
    'Withdraw winnings after a quick bank verification',
    'Compete on the leaderboard for real prizes',
  ];
  switch (v) {
    case 'arcade_credits':
      return {
        title: 'ARCADE CREDITS',
        subtitle: 'You’re about to buy credits for prize runs and the ticket economy',
        tagline: 'PLAY HARDER. REDEEM MORE.',
        bullets: [
          'Buy credit packs with a saved account',
          'Run minigames for tickets and prizes',
          'Sync your balance across devices',
          'Redeem tickets in the prize shop',
        ],
        primaryCta: 'SIGN UP & ADD CREDITS',
      };
    case 'play':
      return {
        title: 'JOIN LIVE MATCHES',
        subtitle: 'You’re about to queue for cash skill matches',
        tagline: 'COMPETE. WIN REAL MONEY.',
        bullets: [
          'Get matched on fair, tiered entry fees',
          'Play the same skill games you know from Arcade',
          'Win cash credited to your wallet',
          'Track record, streaks, and payouts in your profile',
        ],
        primaryCta: 'SIGN UP & PLAY',
      };
    case 'withdraw':
      return {
        title: 'CASH OUT SECURELY',
        subtitle: 'You’re about to set up withdrawals to your bank',
        tagline: 'YOUR WINNINGS. YOUR BANK.',
        bullets: [
          'Link a bank account through our secure partner',
          'Move wallet balance when you’re verified',
          'See payout history on your profile',
          'Separate from card deposits — only for cash-outs',
        ],
        primaryCta: 'SIGN UP TO WITHDRAW',
      };
    case 'prizes':
      return {
        title: 'PRIZES & CREDITS',
        subtitle: 'You’re about to open the shop and redemption flows',
        tagline: 'REDEEM WHAT YOU EARN.',
        bullets: [
          'Buy arcade credits and see live pricing',
          'Redeem tickets for digital and physical prizes',
          'Keep shipping info on your account',
          'Never lose progress when you switch devices',
        ],
        primaryCta: 'SIGN UP & CONTINUE',
      };
    case 'shipping':
      return {
        title: 'SHIPPING DETAILS',
        subtitle: 'Save where we should send physical prizes',
        tagline: 'REAL PRIZES NEED A REAL ADDRESS.',
        bullets: [
          'Store your shipping address securely',
          'Required for physical redemptions',
          'Update anytime from your profile',
          'Tied to your account for support',
        ],
        primaryCta: 'SIGN UP & CONTINUE',
      };
    case 'wallet':
    default:
      return {
        title: 'MANAGE YOUR WALLET',
        subtitle: 'You’re about to add funds to your wallet',
        tagline: 'START WINNING REAL MONEY TODAY!',
        bullets: skillBullets,
        primaryCta: 'SIGN UP & DEPOSIT',
      };
  }
}

type Props = {
  visible: boolean;
  variant: GuestAuthPromptVariant;
  onClose: () => void;
};

/** VAZA-style conversion modal when a signed-out user hits a real-money / account-only action (backend on). */
export function GuestAuthPromptModal({ visible, variant, onClose }: Props) {
  const router = useRouter();
  const c = copyForVariant(variant);

  function goSignUp() {
    onClose();
    router.push('/(auth)/sign-up');
  }

  function goSignIn() {
    onClose();
    router.push('/(auth)/sign-in');
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={2}>
              {c.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={14} accessibilityRole="button" accessibilityLabel="Close">
              <SafeIonicons name="close" size={26} color="rgba(148,163,184,0.95)" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.subtitle}>{c.subtitle}</Text>
            <Text style={styles.tagline}>{c.tagline}</Text>

            <Text style={styles.bulletsHead}>Sign up now to:</Text>
            {c.bullets.map((line) => (
              <View key={line} style={styles.bulletRow}>
                <SafeIonicons name="checkmark-circle" size={18} color="#4ade80" style={styles.bulletIcon} />
                <Text style={styles.bulletTxt}>{line}</Text>
              </View>
            ))}

            <Pressable onPress={goSignUp} style={({ pressed }) => [styles.primaryOuter, pressed && { opacity: 0.92 }]}>
              <LinearGradient
                colors={['#22d3ee', '#06b6d4', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryGrad}
              >
                <Text style={styles.primaryTxt}>{c.primaryCta}</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={goSignIn}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryTxt}>SIGN IN</Text>
            </Pressable>

            <Text style={styles.legal}>
              By signing up, you agree to our{' '}
              <Text style={styles.legalLink} onPress={() => void openTermsOfService()}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => void openPrivacyPolicy()}>
                Privacy Policy
              </Text>
              .
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,6,23,0.78)',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(24,28,38,0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
    maxHeight: '88%',
  },
  scroll: { maxHeight: 520 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  subtitle: {
    color: 'rgba(248,250,252,0.92)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  tagline: {
    color: '#22d3ee',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 16,
  },
  bulletsHead: {
    color: 'rgba(226,232,240,0.9)',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 10,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  bulletIcon: { marginTop: 1 },
  bulletTxt: {
    flex: 1,
    color: 'rgba(226,232,240,0.92)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  primaryOuter: { borderRadius: 12, overflow: 'hidden', marginTop: 8, marginBottom: 10 },
  primaryGrad: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontFamily: runitFont.black,
  },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  secondaryTxt: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  legal: {
    color: 'rgba(148,163,184,0.88)',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLink: {
    color: '#67e8f9',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
