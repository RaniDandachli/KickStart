import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALLOW_GUEST_MODE, ENABLE_BACKEND } from '@/constants/featureFlags';
import { setHasSeenWelcome } from '@/lib/onboardingStorage';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { returning } = useLocalSearchParams<{ returning?: string }>();
  const isReturning = returning === '1' || returning === 'true';

  async function markWelcomeAndGo(path: '/(app)/(tabs)' | '/(auth)/sign-in' | '/(auth)/sign-up') {
    await setHasSeenWelcome();
    router.replace(path);
  }

  return (
    <LinearGradient
      colors={['#050208', '#12081f', '#06020e', '#0a0418']}
      locations={[0, 0.35, 0.65, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.root}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={styles.hero}>
          <Text style={styles.kicker}>{isReturning ? 'BACK AT THE LOBBY' : 'WELCOME TO'}</Text>
          <Text style={[styles.logo, { fontFamily: runitFont.black }, runitTextGlowPink]}>RUN IT</Text>
          <Text style={[styles.tag, runitTextGlowCyan]}>
            {isReturning
              ? 'Sign in to sync your profile, or jump back in.'
              : 'Neon arcade duels, events, and prizes — one floor.'}
          </Text>
        </View>

        <View style={styles.steps}>
          {[
            ['home', 'Home', 'News, streaks & quick links'],
            ['trophy', 'Events', 'Brackets & tournaments'],
            ['game-controller', 'Arcade', 'Minigames & quick matches'],
            ['gift', 'Prizes', 'Redeem tickets & credits'],
            ['person', 'You', 'Wallet, profile & settings'],
          ].map(([icon, title, sub]) => (
            <View key={title} style={styles.stepRow}>
              <LinearGradient colors={[runit.neonPurple, runit.neonPink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepIco}>
                <Ionicons name={icon as 'home'} size={20} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.hint}>After you enter, we will point at each tab once — quick and clean.</Text>

        <View style={styles.actions}>
          {ALLOW_GUEST_MODE ? (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
              onPress={() => void markWelcomeAndGo('/(app)/(tabs)')}
            >
              <LinearGradient colors={[runit.neonPink, '#c9184a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>
                <Text style={[styles.btnPrimaryText, { fontFamily: runitFont.bold }]}>ENTER THE ARCADE</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          ) : null}

          {ALLOW_GUEST_MODE ? (
            <View style={styles.secondaryAuth}>
              <Pressable onPress={() => void markWelcomeAndGo('/(auth)/sign-in')}>
                <Text style={styles.link}>Sign in</Text>
              </Pressable>
              <Text style={styles.mutedDot}> · </Text>
              <Pressable onPress={() => void markWelcomeAndGo('/(auth)/sign-up')}>
                <Text style={styles.link}>Create account</Text>
              </Pressable>
            </View>
          ) : null}

          {ENABLE_BACKEND ? (
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, ALLOW_GUEST_MODE ? {} : { marginBottom: 0 }, pressed && { opacity: 0.9 }]}
              onPress={() => void markWelcomeAndGo('/(auth)/sign-in')}
            >
              <LinearGradient colors={[runit.neonPink, '#c9184a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnGrad}>
                <Text style={[styles.btnPrimaryText, { fontFamily: runitFont.bold }]}>SIGN IN</Text>
                <Ionicons name="log-in-outline" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          ) : null}

          {ENABLE_BACKEND ? (
            <View style={styles.links}>
              <Pressable onPress={() => void markWelcomeAndGo('/(auth)/sign-up')}>
                <Text style={styles.link}>Create account</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 22 },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  kicker: {
    color: 'rgba(0,240,255,0.85)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 8,
  },
  logo: {
    color: '#fff',
    fontSize: 44,
    letterSpacing: 6,
    marginBottom: 12,
  },
  tag: {
    textAlign: 'center',
    color: 'rgba(226,232,240,0.92)',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 8,
    fontWeight: '600',
  },
  steps: { gap: 10, marginBottom: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIco: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  stepSub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginTop: 1 },
  hint: {
    textAlign: 'center',
    color: 'rgba(148,163,184,0.75)',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 18,
  },
  actions: { marginTop: 8, marginBottom: 8 },
  btnPrimary: { marginBottom: 14, borderRadius: 14, overflow: 'hidden' },
  btnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  btnPrimaryText: { color: '#fff', fontSize: 15, letterSpacing: 1.2 },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 8 },
  link: { color: runit.neonCyan, fontSize: 15, fontWeight: '800' },
  secondaryAuth: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
    paddingVertical: 6,
    gap: 4,
  },
  mutedDot: { color: 'rgba(148,163,184,0.55)', fontSize: 15 },
});
