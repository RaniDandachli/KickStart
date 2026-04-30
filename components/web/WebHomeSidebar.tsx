import { usePathname, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { ARCADE_SOCIAL_URLS, type ArcadeSocialKey } from '@/lib/arcadeSocialLinks';
import { runItArcadeLogoSource } from '@/lib/brandLogo';
import { runitFont } from '@/lib/runitArcadeTheme';

const BRAND_GOLD = '#FFD700';

type TabKey = 'home' | 'tournaments' | 'play' | 'prizes' | 'profile';

function useActiveTab(): TabKey {
  const p = usePathname() ?? '';
  if (p.includes('/tournaments')) return 'tournaments';
  if (p.includes('/play')) return 'play';
  if (p.includes('/prizes')) return 'prizes';
  if (p.includes('/profile')) return 'profile';
  return 'home';
}

type TabHref =
  | `/(app)/(tabs)`
  | `/(app)/(tabs)/tournaments`
  | `/(app)/(tabs)/play`
  | `/(app)/(tabs)/prizes`
  | `/(app)/(tabs)/profile`;

type SidebarItem = {
  key: TabKey;
  label: string;
  href: TabHref;
  icon: ComponentProps<typeof SafeIonicons>['name'];
};

const ITEMS: SidebarItem[] = [
  { key: 'home', label: 'Home', href: '/(app)/(tabs)', icon: 'home' },
  { key: 'tournaments', label: 'Events', href: '/(app)/(tabs)/tournaments', icon: 'trophy' },
  { key: 'play', label: 'Arcade', href: '/(app)/(tabs)/play', icon: 'game-controller' },
  { key: 'prizes', label: 'Prizes', href: '/(app)/(tabs)/prizes', icon: 'gift' },
  { key: 'profile', label: 'You', href: '/(app)/(tabs)/profile', icon: 'person' },
];

const SOCIAL_ICONS: { key: ArcadeSocialKey; icon: ComponentProps<typeof SafeIonicons>['name']; label: string }[] = [
  { key: 'discord', icon: 'logo-discord', label: 'Discord' },
  { key: 'instagram', icon: 'logo-instagram', label: 'Instagram' },
  { key: 'x', icon: 'logo-twitter', label: 'X' },
  { key: 'youtube', icon: 'logo-youtube', label: 'YouTube' },
];

export function WebHomeSidebar() {
  const router = useRouter();
  const active = useActiveTab();

  const openSocial = useCallback((key: ArcadeSocialKey) => {
    const url = ARCADE_SOCIAL_URLS[key]?.trim();
    if (!url) return;
    void Linking.openURL(url);
  }, []);

  return (
    <View style={styles.rail} accessibilityRole="menu">
      <View style={styles.logoBlock}>
        <Image source={runItArcadeLogoSource} style={styles.logoImg} contentFit="contain" />
        <Text style={[styles.brandName, { fontFamily: runitFont.black }]}>RUN iT</Text>
        <Text style={styles.brandSub}>ARCADE</Text>
      </View>
      <View style={styles.navList}>
        {ITEMS.map((it) => {
          const on = it.key === active;
          return (
            <Pressable
              key={it.key}
              onPress={() => router.push(it.href)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && { opacity: 0.9 }]}
            >
              <SafeIonicons name={it.icon} size={20} color={on ? '#0c0618' : 'rgba(226,232,240,0.9)'} />
              <Text style={[styles.itemTxt, on && styles.itemTxtOn]} numberOfLines={1}>
                {it.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.railSpacer} />
      <View style={styles.socialSection}>
        <View style={styles.socialRow}>
          {SOCIAL_ICONS.map(({ key, icon, label }) => {
            const url = ARCADE_SOCIAL_URLS[key]?.trim();
            const enabled = Boolean(url);
            return (
              <Pressable
                key={key}
                onPress={() => openSocial(key)}
                disabled={!enabled}
                accessibilityRole="link"
                accessibilityLabel={label}
                accessibilityHint={enabled ? 'Opens in browser' : 'Link not set yet'}
                accessibilityState={{ disabled: !enabled }}
                style={({ pressed }) => [
                  styles.socialBtn,
                  !enabled && styles.socialBtnDisabled,
                  pressed && enabled && { opacity: 0.82 },
                ]}
              >
                <SafeIonicons
                  name={icon}
                  size={18}
                  color={enabled ? 'rgba(226,232,240,0.72)' : 'rgba(148,163,184,0.35)'}
                />
              </Pressable>
            );
          })}
        </View>
        <View style={styles.socialFootRing} accessibilityElementsHidden />
      </View>
      <View style={styles.railFooter}>
        <Text style={styles.railHint}>1v1 · tiers · real matchups</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: 248,
    flexShrink: 0,
    minHeight: 0,
    alignSelf: 'stretch',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(2,0,8,0.88)',
    borderRightWidth: 1,
    borderColor: 'rgba(139,92,246,0.22)',
    borderRadius: 0,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,215,0,0.2)',
  },
  /** Larger crest — primary brand lockup for laptop dashboard. */
  logoImg: { width: 256, height: 96, marginBottom: 8 },
  brandName: {
    color: '#f8fafc',
    fontSize: 13,
    letterSpacing: 2,
  },
  brandSub: {
    color: BRAND_GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 2,
  },
  navList: { gap: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  itemOn: {
    backgroundColor: 'rgba(255,215,0,0.9)',
  },
  itemTxt: {
    flex: 1,
    color: 'rgba(226,232,240,0.95)',
    fontSize: 14,
    fontWeight: '800',
  },
  itemTxtOn: { color: '#0c0618' },
  railSpacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 16,
  },
  socialSection: {
    paddingTop: 8,
    alignItems: 'center',
    gap: 12,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
  },
  socialBtnDisabled: {
    opacity: 0.65,
  },
  /** Decorative accent under social row (reference layout). */
  socialFootRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: 'transparent',
  },
  railFooter: { marginTop: 10, paddingHorizontal: 4 },
  railHint: { color: 'rgba(148,163,184,0.7)', fontSize: 10, lineHeight: 15, fontWeight: '600' },
});
