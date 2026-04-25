import { useRouter } from 'expo-router';
import { Alert, Linking, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { QuickMatchTierChips } from '@/components/arcade/QuickMatchTierChips';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { useProfile } from '@/hooks/useProfile';
import { refreshArcadeScheduledNotifications } from '@/lib/arcadeLocalNotifications';
import { supportContactHref } from '@/lib/env';
import { registerExpoPushWithSupabase } from '@/lib/expoPushRegistration';
import { H2H_OPEN_GAMES } from '@/lib/homeOpenMatches';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/lib/settingsNotificationPrefs';
import { ROUTES, safeBack } from '@/lib/appNavigation';
import { normalizeQuickMatchAllowedEntries } from '@/lib/quickMatchTiers';
import { profileBlocksPaidSkillContest } from '@/lib/skillContestRegionGate';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';
import { isWebPushConfigured, registerWebPushForUser, unregisterWebPushForUser } from '@/lib/webPushRegister';
import { useAuthStore } from '@/store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const uid = useAuthStore((s) => s.user?.id);
  const profileQ = useProfile(ENABLE_BACKEND && uid ? uid : undefined);
  const [pushMatch, setPushMatch] = useState(true);
  const [pushTournament, setPushTournament] = useState(true);
  const [pushDailyCredits, setPushDailyCredits] = useState(true);
  const [pushOpenMatches, setPushOpenMatches] = useState(false);
  const [openWatchEntryCents, setOpenWatchEntryCents] = useState<number[]>([]);
  const [openWatchGameKeys, setOpenWatchGameKeys] = useState<string[]>([]);
  const [tierCapCents, setTierCapCents] = useState(0);
  const [prefsReady, setPrefsReady] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void loadNotificationPrefs()
      .then((p) => {
        if (cancelled) return;
        setPushMatch(p.matchInvites);
        setPushTournament(p.tournamentUpdates);
        setPushDailyCredits(p.dailyCredits);
        setPushOpenMatches(p.openMatchAlerts);
        setOpenWatchEntryCents(p.openMatchWatchEntryCents ?? []);
        setOpenWatchGameKeys(
          Array.isArray(p.openMatchWatchGameKeys) && p.openMatchWatchGameKeys.length > 0
            ? [...p.openMatchWatchGameKeys]
            : [],
        );
        setPrefsReady(true);
      })
      .catch(() => {
        if (!cancelled) setPrefsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ENABLE_BACKEND || !uid) {
      setTierCapCents(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      const blocked = await profileBlocksPaidSkillContest(uid);
      const live = profileQ.data?.wallet_cents ?? 0;
      if (cancelled) return;
      setTierCapCents(blocked ? 0 : live);
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, profileQ.data?.wallet_cents]);

  useEffect(() => {
    if (!prefsReady || !pushOpenMatches) return;
    setOpenWatchEntryCents((prev) => normalizeQuickMatchAllowedEntries(prev, tierCapCents));
  }, [prefsReady, pushOpenMatches, tierCapCents]);

  useEffect(() => {
    if (!prefsReady) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const prefsPayload = {
      matchInvites: pushMatch,
      tournamentUpdates: pushTournament,
      dailyCredits: pushDailyCredits,
      openMatchAlerts: pushOpenMatches,
      openMatchWatchEntryCents: openWatchEntryCents,
      openMatchWatchGameKeys: openWatchGameKeys.length > 0 ? openWatchGameKeys : null,
    };
    void saveNotificationPrefs(prefsPayload).then(async () => {
      if (uid && ENABLE_BACKEND) {
        if (Platform.OS === 'web') {
          if (pushOpenMatches && isWebPushConfigured()) {
            const wr = await registerWebPushForUser();
            if (!wr.ok) {
              /** Keep toggle + prefs on — account still wants alerts; browser subscribe can be retried (toggle off/on) after fixing SW / permissions / Edge deploy. */
              Alert.alert(
                'Browser couldn’t finish push setup',
                `${wr.error}\n\nOpen match alerts stay on for your account. After you fix the issue (allow notifications, HTTPS, /sw.js, or sign-in), turn this off and on again to retry the browser step.`,
              );
            }
          } else if (!pushOpenMatches) {
            await unregisterWebPushForUser();
          }
        }
        await registerExpoPushWithSupabase(uid);
      }
      void refreshArcadeScheduledNotifications();
    });
  }, [
    prefsReady,
    pushMatch,
    pushTournament,
    pushDailyCredits,
    pushOpenMatches,
    openWatchEntryCents,
    openWatchGameKeys,
    uid,
  ]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => safeBack(router, ROUTES.profileTab)}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to You"
        >
          <SafeIonicons name="chevron-back" size={26} color="#e2e8f0" />
        </Pressable>
        <Text style={[styles.screenTitle, styles.screenTitleHeader]} numberOfLines={1}>
          Settings
        </Text>
        <View style={styles.backSpacer} />
      </View>
      <Text style={styles.screenSub}>Notifications, shipping, and support</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SafeIonicons name="notifications-outline" size={22} color={runit.neonCyan} />
          <Text style={styles.cardTitle}>Notifications</Text>
        </View>
        <RowToggle label="Match invites" value={pushMatch} disabled={!prefsReady} onValueChange={setPushMatch} />
        <RowToggle
          label="Tournament of the Day"
          value={pushTournament}
          disabled={!prefsReady}
          onValueChange={setPushTournament}
        />
        <RowToggle
          label="Daily Arcade Credits"
          value={pushDailyCredits}
          disabled={!prefsReady}
          onValueChange={setPushDailyCredits}
        />
        <RowToggle
          label="Open match alerts"
          value={pushOpenMatches}
          disabled={!prefsReady}
          onValueChange={setPushOpenMatches}
        />
        {pushOpenMatches && prefsReady ? (
          <View style={styles.openWatchSection}>
            <Text style={styles.openWatchTitle}>What should we ping you about?</Text>
            <Text style={styles.openWatchHint}>
              <Text style={styles.openWatchHintEm}>Entry fees:</Text> leave all chips off to mean{' '}
              <Text style={styles.openWatchHintEm}>any</Text> contest price. Otherwise we only alert when a waiter is on a tier you select.
            </Text>
            {ENABLE_BACKEND && uid && profileQ.isFetched && !profileQ.isError ? (
              <QuickMatchTierChips
                maxAffordableEntryCents={tierCapCents}
                selected={openWatchEntryCents}
                onChange={setOpenWatchEntryCents}
              />
            ) : (
              <Text style={styles.openWatchHint}>Sign in to pick paid tiers (free tier is always available).</Text>
            )}
            <Text style={[styles.openWatchHint, styles.openWatchHintSpaced]}>
              <Text style={styles.openWatchHintEm}>Games:</Text> tap to narrow. Leave none highlighted for{' '}
              <Text style={styles.openWatchHintEm}>any</Text> minigame.
            </Text>
            <View style={styles.gameChipWrap}>
              {H2H_OPEN_GAMES.map((g) => {
                const on = openWatchGameKeys.includes(g.gameKey);
                return (
                  <Pressable
                    key={g.gameKey}
                    onPress={() => {
                      setOpenWatchGameKeys((prev) => {
                        const s = new Set(prev);
                        if (s.has(g.gameKey)) s.delete(g.gameKey);
                        else s.add(g.gameKey);
                        return Array.from(s);
                      });
                    }}
                    style={({ pressed }) => [styles.gameChip, on && styles.gameChipOn, pressed && { opacity: 0.9 }]}
                  >
                    <Text style={[styles.gameChipTxt, on && styles.gameChipTxtOn]}>{g.title}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <Text style={styles.helpText}>
          Preferences are saved on this device and on your account when you&apos;re signed in. Tournament reminders follow the schedule the
          operator sets; daily credit reminders fire after you claim for the day. Open match alerts notify you when someone is waiting in
          queue for a contest that matches the filters above (on web, allow browser notifications). &quot;Match found&quot; uses Keep my
          spot in queue on the match screen. You can change alerts in system notification settings too.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SafeIonicons name="cube-outline" size={22} color={runit.neonCyan} />
          <Text style={styles.cardTitle}>Prize shipping</Text>
        </View>
        <Text style={styles.bodyText}>Physical prizes ship to the address you save. You can also add it when you redeem.</Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.primaryLink, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/shipping-address')}
        >
          <Text style={styles.primaryLinkText}>Shipping address</Text>
          <SafeIonicons name="chevron-forward" size={20} color={runit.neonCyan} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitleOnly}>More</Text>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/marketing')}
        >
          <SafeIonicons name="megaphone-outline" size={22} color="#bef264" />
          <Text style={styles.listRowLabel}>Marketing (internal)</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/dispute')}
        >
          <SafeIonicons name="shield-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Dispute a match</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/(tabs)/profile/legal')}
        >
          <SafeIonicons name="document-text-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Legal</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.listRow, styles.listRowLast, pressed && styles.pressed]}
          onPress={() => {
            const href = supportContactHref();
            if (href) {
              void Linking.openURL(href);
              return;
            }
            router.push('/(app)/(tabs)/profile/support');
          }}
        >
          <SafeIonicons name="help-circle-outline" size={22} color="#e2e8f0" />
          <Text style={styles.listRowLabel}>Support</Text>
          <SafeIonicons name="chevron-forward" size={20} color="rgba(226,232,240,0.5)" />
        </Pressable>
      </View>
    </Screen>
  );
}

function RowToggle({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.18)', true: 'rgba(167,139,250,0.9)' }}
        thumbColor={value ? '#f8fafc' : '#94a3b8'}
        ios_backgroundColor="rgba(255,255,255,0.2)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  backSpacer: { width: 44 },
  screenTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
  },
  screenTitleHeader: {
    flex: 1,
    textAlign: 'center',
    marginBottom: 0,
    fontFamily: runitFont.black,
    ...runitTextGlowPink,
  },
  screenSub: {
    color: 'rgba(203,213,225,0.9)',
    fontSize: 15,
    marginBottom: 20,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(157, 78, 237, 0.4)',
    backgroundColor: 'rgba(12, 6, 22, 0.88)',
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  cardTitleOnly: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  toggleLabel: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  helpText: {
    marginTop: 12,
    color: 'rgba(203,213,225,0.88)',
    fontSize: 14,
    lineHeight: 21,
  },
  openWatchSection: {
    marginTop: 4,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
  },
  openWatchTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
  },
  openWatchHint: {
    color: 'rgba(203,213,225,0.9)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  openWatchHintSpaced: {
    marginTop: 14,
  },
  openWatchHintEm: {
    color: '#e2e8f0',
    fontWeight: '800',
  },
  gameChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gameChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  gameChipOn: {
    borderColor: 'rgba(255,215,0,0.65)',
    backgroundColor: 'rgba(14,116,144,0.25)',
  },
  gameChipTxt: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 12,
    fontWeight: '700',
  },
  gameChipTxtOn: {
    color: '#FFF8E1',
  },
  bodyText: {
    color: 'rgba(203,213,225,0.92)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  primaryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
    gap: 8,
  },
  primaryLinkText: {
    color: runit.neonCyan,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.2)',
    minHeight: 54,
  },
  listRowLast: {
    paddingBottom: 4,
  },
  listRowLabel: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(167,139,250,0.08)',
  },
});
