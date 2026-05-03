import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { formatAuthError } from '@/lib/authMessages';
import { TERMS_PRIVACY_DOC_VERSION, openPrivacyPolicy, openTermsOfService } from '@/lib/legalLinks';
import { setHasSeenWelcome } from '@/lib/onboardingStorage';
import { runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';
import { getDeviceRegionCountryCode } from '@/lib/deviceRegionCountry';
import { updateProfileFields } from '@/services/api/profiles';
import { getSupabase } from '@/supabase/client';

type PayoutCountry = 'US' | 'CA';

function defaultPayoutCountry(): PayoutCountry {
  const d = getDeviceRegionCountryCode();
  return d === 'CA' ? 'CA' : 'US';
}

export default function SignUpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [countryCode, setCountryCode] = useState<PayoutCountry>(() => defaultPayoutCountry());
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!agreedToLegal) {
      Alert.alert('Agreement required', 'Please confirm you agree to the Terms of service and Privacy policy to create an account.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const acceptedAt = new Date().toISOString();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim().toLowerCase(),
            display_name: username.trim(),
            terms_accepted_at: acceptedAt,
            terms_docs_version: TERMS_PRIVACY_DOC_VERSION,
            country_code: countryCode,
          },
        },
      });
      if (error) throw error;
      await setHasSeenWelcome();
      if (data.session && data.user?.id) {
        try {
          await updateProfileFields(data.user.id, { country_code: countryCode });
        } catch {
          /* profile row / RLS edge — metadata + useSyncSignupCountry still carry country */
        }
        router.replace('/(app)/(tabs)');
        return;
      }
      Alert.alert(
        'Check your email',
        'We sent you a link to verify your address. Open it, then sign in with your email and password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }]
      );
    } catch (e: unknown) {
      Alert.alert('Create account', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <LinearGradient colors={[runit.neonPurple, '#5a189a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.kicker}>JOIN THE FLOOR</Text>
        <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>CREATE ACCOUNT</Text>
        <Text style={styles.sub}>Pick a unique username for leaderboards. You may need to confirm your email before your first sign-in.</Text>
      </LinearGradient>
      <KCTextInput label="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
      <Text style={styles.countryLabel}>Country (for payouts)</Text>
      <View style={styles.countryRow}>
        {(
          [
            { code: 'US' as const, label: 'United States' },
            { code: 'CA' as const, label: 'Canada' },
          ] as const
        ).map(({ code, label }) => (
          <Pressable
            key={code}
            accessibilityRole="button"
            accessibilityState={{ selected: countryCode === code }}
            onPress={() => setCountryCode(code)}
            style={[styles.countryChip, countryCode === code && styles.countryChipOn]}
          >
            <Text style={[styles.countryChipText, countryCode === code && styles.countryChipTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <KCTextInput label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <KCTextInput label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <View style={styles.agreeRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToLegal }}
          onPress={() => setAgreedToLegal((v) => !v)}
          hitSlop={8}
        >
          <View style={[styles.checkbox, agreedToLegal && styles.checkboxOn]}>
            {agreedToLegal ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
        </Pressable>
        <Text style={styles.agreeText}>
          I agree to RuniT Arcade’s{' '}
          <Text style={styles.agreeLink} onPress={() => void openTermsOfService()}>
            Terms of service
          </Text>{' '}
          and{' '}
          <Text style={styles.agreeLink} onPress={() => void openPrivacyPolicy()}>
            Privacy policy
          </Text>
          .
        </Text>
      </View>
      <AppButton
        title="Sign up"
        loading={loading}
        disabled={!agreedToLegal}
        onPress={() => void onSubmit()}
      />
      <Link href="/(auth)/sign-in" className="mt-4">
        <Text style={styles.link}>Already have an account?</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  kicker: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 6,
  },
  title: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 24,
    letterSpacing: 2,
    marginBottom: 8,
  },
  sub: {
    textAlign: 'center',
    color: 'rgba(226,232,240,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  countryLabel: {
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  countryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  countryChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  countryChipOn: {
    borderColor: runit.neonCyan,
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
  countryChipText: { color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  countryChipTextOn: { color: '#fff' },
  link: { textAlign: 'center', fontSize: 15, fontWeight: '800', color: runit.neonPink },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.55)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    borderColor: runit.neonCyan,
    backgroundColor: 'rgba(167,139,250,0.15)',
  },
  checkMark: { color: runit.neonCyan, fontSize: 14, fontWeight: '900' },
  agreeText: {
    flex: 1,
    color: 'rgba(226,232,240,0.95)',
    fontSize: 13,
    lineHeight: 19,
  },
  agreeLink: { color: runit.neonCyan, fontWeight: '800', textDecorationLine: 'underline' },
});
