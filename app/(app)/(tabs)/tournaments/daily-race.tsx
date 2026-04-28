import { useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import type { SoloChallengeBundle } from '@/lib/soloChallenges';
import { todayYmdLocal } from '@/lib/dailyFreeTournament';
import { MONEY_CHALLENGES, toSoloChallengeBundle } from '@/lib/moneyChallenges';
import { SOLO_CHALLENGE_MAX_TRIES_PER_DAY, getSoloTriesUsedToday } from '@/lib/soloChallengeTries';
import { invalidateProfileEconomy } from '@/lib/invalidateProfileEconomy';
import { queryKeys } from '@/lib/queryKeys';
import { enterMoneyChallengeWallet } from '@/services/api/moneyChallengesWallet';
import { dailyRaceHref } from '@/lib/tabRoutes';
import { useAuthStore } from '@/store/authStore';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

function buildNavigateParams(bundle: SoloChallengeBundle): {
  challengeId: string;
  targetScore: string;
  prizeLabel: string;
} {
  return {
    challengeId: encodeURIComponent(bundle.challengeId),
    targetScore: String(bundle.targetScore),
    prizeLabel: encodeURIComponent(bundle.prizeLabel),
  };
}

/** Daily Race hub — Tap Dash showcase targets (Events tab → stack). */
export default function DailyRaceScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const [tries, setTries] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const next: Record<string, number> = {};
    for (const c of MONEY_CHALLENGES) {
      next[c.id] = await getSoloTriesUsedToday(c.id);
    }
    setTries(next);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const startChallenge = useCallback(
    async (c: (typeof MONEY_CHALLENGES)[number]) => {
      const bundle = toSoloChallengeBundle(c);
      const dayKey = todayYmdLocal();

      if (c.kind === 'paid') {
        if (!ENABLE_BACKEND) {
          Alert.alert(
            'Unavailable',
            'Wallet tiers need the live API (EXPO_PUBLIC_ENABLE_BACKEND=true).',
          );
          return;
        }
        if (!uid) {
          Alert.alert('Sign in required', 'Paid Daily Race tiers debit your cash wallet once per day.');
          return;
        }
        const r = await enterMoneyChallengeWallet(c.id, dayKey);
        if (!r.ok) {
          const code = r.error ?? '';
          const msg =
            code === 'insufficient_wallet'
              ? 'Not enough cash in your wallet for this $5 daily unlock. Add funds on your profile, then try again.'
              : code === 'unknown_challenge'
                ? 'This challenge is not available on the server yet. Try again after app update or contact support.'
                : 'Could not unlock today’s tier. Add funds if needed.';
          Alert.alert('Wallet', msg);
          return;
        }
        await refresh();
        void qc.invalidateQueries({ queryKey: queryKeys.profile(uid) });
        void invalidateProfileEconomy(qc, uid);
      }

      const q = buildNavigateParams(bundle);
      const ret = encodeURIComponent(String(dailyRaceHref()));
      router.push(
        `/(app)/(tabs)/tournaments/minigames/tap-dash?challengeId=${q.challengeId}&targetScore=${q.targetScore}&prizeLabel=${q.prizeLabel}&returnHref=${ret}` as never,
      );
    },
    [qc, refresh, router, uid],
  );

  return (
    <Screen scroll>
      <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>
        DAILY RACE
      </Text>
      <Text style={styles.sectionLabel}>CHALLENGES</Text>
      <Text style={styles.sub}>
        Tap Dash showcase targets · free lanes (10 tries) or wallet tiers — prizes subject to eligibility & verification
      </Text>

      {MONEY_CHALLENGES.map((c) => {
        const used = tries[c.id] ?? 0;
        const cap = c.maxAttemptsPerDay ?? SOLO_CHALLENGE_MAX_TRIES_PER_DAY;
        const remaining = Math.max(0, cap - used);

        return (
          <Pressable
            key={c.id}
            onPress={() => void startChallenge(c)}
            style={({ pressed }) => [styles.cardWrap, pressed && { opacity: 0.93 }]}
          >
            <LinearGradient
              colors={c.kind === 'paid' ? ['#fde047', runit.neonPurple] : [runit.neonPink, '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardBorder}
            >
              <View style={styles.cardInner}>
                <View style={styles.rowTop}>
                  <Text style={[styles.cardName, { fontFamily: runitFont.bold }]}>{c.title}</Text>
                  <View style={[styles.pill, c.kind === 'paid' && styles.pillGold]}>
                    <Text style={[styles.pillTxt, c.kind === 'paid' && styles.pillTxtDark]}>
                      {c.kind === 'paid' ? 'WALLET ENTRY' : 'FREE TODAY'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.meta}>{c.subtitle}</Text>
                <Text style={styles.prize}>
                  ${c.showcasePrizeUsd} showcase prize · up to {cap} tries today
                  {c.entryFeeWalletCents != null
                    ? ` · $${(c.entryFeeWalletCents / 100).toFixed(2)} once per day to unlock attempts`
                    : ''}
                </Text>
                <Text style={styles.tries}>
                  Remaining tries: {remaining}/{cap}
                </Text>
                <View style={styles.footer}>
                  <Text style={styles.link}>
                    {c.kind === 'paid' ? 'Unlock & chase target' : 'Play challenge'}
                  </Text>
                  <SafeIonicons name="chevron-forward" size={14} color={runit.neonPink} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, letterSpacing: 1, marginBottom: 4, color: '#fff' },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(253,186,219,0.85)',
    fontWeight: '800',
    marginBottom: 12,
  },
  sub: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 20, marginBottom: 22 },
  cardWrap: { marginBottom: 16 },
  cardBorder: { borderRadius: 16, padding: 2 },
  cardInner: { backgroundColor: 'rgba(6,2,14,0.92)', borderRadius: 14, padding: 16 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardName: { flex: 1, color: '#fff', fontSize: 17 },
  pill: {
    backgroundColor: 'rgba(236,72,153,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillGold: { backgroundColor: 'rgba(253,224,71,0.45)' },
  pillTxt: { color: '#fce7f3', fontSize: 11 },
  pillTxtDark: { color: '#422006', fontWeight: '700' },
  meta: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginBottom: 6 },
  prize: { color: 'rgba(253,224,71,0.95)', fontSize: 13, marginBottom: 4 },
  tries: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginBottom: 10 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { color: runit.neonPink, fontSize: 13, fontWeight: '600' },
});
