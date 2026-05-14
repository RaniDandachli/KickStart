import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { ArcadeSocialKey } from '@/lib/arcadeSocialLinks';

const DISCORD_BLURPLE = '#5865F2';
const X_BLACK = '#0a0a0a';

/** Sidebar rail: Discord · Instagram · X only. */
export type SidebarSocialKey = Extract<ArcadeSocialKey, 'discord' | 'instagram' | 'x'>;

type Props = {
  items: { key: SidebarSocialKey; url: string }[];
  onOpen: (key: ArcadeSocialKey) => void;
};

function DiscordGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
      />
    </Svg>
  );
}

function XGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </Svg>
  );
}

function InstagramGlyph({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth={1.75} fill="none" />
      <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={1.65} fill="none" />
      <Circle cx="17.5" cy="6.5" r="1.35" fill={color} />
    </Svg>
  );
}

const LABELS: Record<SidebarSocialKey, string> = {
  discord: 'Discord',
  instagram: 'Instagram',
  x: 'X',
};

export function SidebarBrandedSocialRow({ items, onOpen }: Props) {
  return (
    <View style={styles.wrap}>
      {items.map(({ key, url }) => {
        const enabled = Boolean(url?.trim());
        const label = LABELS[key];

        const inner =
          key === 'discord' ? (
            <View style={[styles.btnInner, styles.discordInner]}>
              <DiscordGlyph color="#fff" />
            </View>
          ) : key === 'x' ? (
            <View style={[styles.btnInner, styles.xInner]}>
              <XGlyph color="#fff" />
            </View>
          ) : (
            <LinearGradient
              colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btnInner}
            >
              <InstagramGlyph color="#fff" />
            </LinearGradient>
          );

        return (
          <Pressable
            key={key}
            onPress={() => onOpen(key)}
            disabled={!enabled}
            accessibilityRole="link"
            accessibilityLabel={label}
            accessibilityHint={enabled ? 'Opens in browser' : 'Link not set yet'}
            accessibilityState={{ disabled: !enabled }}
            style={({ pressed }) => [
              styles.hit,
              key === 'discord' && styles.hitDiscord,
              key === 'x' && styles.hitX,
              key === 'instagram' && styles.hitInstagram,
              !enabled && styles.hitDisabled,
              pressed && enabled && styles.hitPressed,
            ]}
          >
            {inner}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    flexWrap: 'nowrap',
    gap: 8,
    marginTop: 14,
    marginBottom: 2,
    paddingHorizontal: 8,
  },
  hit: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  hitDiscord: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 22px rgba(88, 101, 242, 0.75)' }
      : {
          shadowColor: '#5865F2',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.85,
          shadowRadius: 10,
          elevation: 10,
        }),
  },
  hitX: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 18px rgba(255, 255, 255, 0.35)' }
      : {
          shadowColor: '#ffffff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 6,
        }),
  },
  hitInstagram: {
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 22px rgba(236, 72, 153, 0.55)' }
      : {
          shadowColor: '#ec4899',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.55,
          shadowRadius: 10,
          elevation: 8,
        }),
  },
  hitDisabled: {
    opacity: 0.45,
    ...(Platform.OS === 'web' ? { boxShadow: 'none' } : { shadowOpacity: 0, elevation: 0 }),
  },
  hitPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  btnInner: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  discordInner: {
    backgroundColor: DISCORD_BLURPLE,
  },
  xInner: {
    backgroundColor: X_BLACK,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
