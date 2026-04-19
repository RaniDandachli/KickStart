import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  BallRunGameIcon,
  DashDuelGameIcon,
  NeonDanceGameIcon,
  StackerGameIcon,
  TapDashGameIcon,
  TileClashGameIcon,
  TurboArenaGameIcon,
} from '@/components/arcade/MinigameIcons';
import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import {
  DAILY_TOURNAMENT_PROMO,
  GAME_PROMO_CARDS,
  HOW_IT_WORKS_SLIDES,
} from '@/lib/marketingPromoContent';
import { runit, runitFont } from '@/lib/runitArcadeTheme';

/** VAZA-adjacent accents for promo chrome (lime + teal). */
const PROMO_LIME = '#bef264';
const PROMO_GREEN = '#4ade80';
const PROMO_TEAL = '#2dd4bf';

function GameIconForPromo({ id, size }: { id: string; size: number }) {
  switch (id) {
    case 'tap-dash':
      return <TapDashGameIcon size={size} />;
    case 'tile-clash':
      return <TileClashGameIcon size={size} />;
    case 'dash-duel':
      return <DashDuelGameIcon size={size} />;
    case 'ball-run':
      return <BallRunGameIcon size={size} />;
    case 'neon-dance':
      return <NeonDanceGameIcon size={size} />;
    case 'turbo-arena':
      return <TurboArenaGameIcon size={size} />;
    case 'stacker':
      return <StackerGameIcon size={size} />;
    default:
      return <SafeIonicons name="game-controller" size={size} color="#fff" />;
  }
}

export default function MarketingPromoScreen() {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const slideW = winW;
  const scrollRef = useRef<ScrollView>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  const onPagerScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / slideW);
      setSlideIdx(Math.max(0, Math.min(HOW_IT_WORKS_SLIDES.length - 1, i)));
    },
    [slideW],
  );

  const goNextSlide = useCallback(() => {
    const next = Math.min(slideIdx + 1, HOW_IT_WORKS_SLIDES.length - 1);
    scrollRef.current?.scrollTo({ x: next * slideW, animated: true });
    setSlideIdx(next);
  }, [slideIdx, slideW]);

  const goPrevSlide = useCallback(() => {
    const prev = Math.max(slideIdx - 1, 0);
    scrollRef.current?.scrollTo({ x: prev * slideW, animated: true });
    setSlideIdx(prev);
  }, [slideIdx, slideW]);

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.85 }]}
      >
        <SafeIonicons name="chevron-back" size={22} color={PROMO_TEAL} />
        <Text style={styles.backTxt}>Settings</Text>
      </Pressable>

      <View style={styles.internalBanner}>
        <SafeIonicons name="construct-outline" size={18} color="rgba(254,240,138,0.95)" />
        <Text style={styles.internalBannerTxt}>
          Internal marketing kit — safe for screenshots and socials. Remove this screen from Settings before launch.
        </Text>
      </View>

      <Text style={[styles.pageTitle, { fontFamily: runitFont.black }]}>MARKETING</Text>
      <Text style={styles.pageSub}>How it works · Games · Daily tournament — promo copy and visuals</Text>

      <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
      <Text style={styles.sectionHint}>Swipe the cards — same flow vibe as VAZA-style onboarding, Run iT branding.</Text>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        onScrollEndDrag={onPagerScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {HOW_IT_WORKS_SLIDES.map((s) => (
          <View key={s.id} style={[styles.slidePage, { width: slideW }]}>
            <View style={styles.slideCardOuter}>
              <LinearGradient
                colors={['rgba(15,23,42,0.95)', 'rgba(30,27,75,0.92)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.slideCardInner}
              >
                <Image source={s.image} style={styles.slideImage} contentFit="cover" accessibilityLabel="" />
                <View style={styles.slideTextBlock}>
                  <Text style={styles.slideKicker}>{s.kicker}</Text>
                  <Text style={styles.slideTitle}>{s.title}</Text>
                  {s.body.map((line, li) => (
                    <Text key={`${s.id}-b${li}`} style={styles.slideBody}>
                      {line}
                    </Text>
                  ))}
                </View>
              </LinearGradient>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.pagerFooter}>
        <View style={styles.dotsRow}>
          {HOW_IT_WORKS_SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.dot,
                i === slideIdx ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        <View style={styles.pagerNav}>
          <Pressable
            onPress={goPrevSlide}
            disabled={slideIdx === 0}
            style={({ pressed }) => [styles.iconPill, pressed && slideIdx > 0 && { opacity: 0.8 }]}
          >
            <SafeIonicons name="chevron-back" size={22} color={slideIdx === 0 ? '#475569' : '#e2e8f0'} />
          </Pressable>
          <Pressable onPress={goNextSlide} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
            <LinearGradient
              colors={[PROMO_LIME, PROMO_TEAL]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextCta}
            >
              <Text style={styles.nextCtaTxt}>{slideIdx >= HOW_IT_WORKS_SLIDES.length - 1 ? 'Done' : 'Next'}</Text>
              <SafeIonicons name="chevron-forward" size={20} color="#0f172a" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionLabel}>GAME SPOTLIGHTS</Text>
      <Text style={styles.sectionHint}>One card per title — grab screenshots here or in the real game routes.</Text>

      {GAME_PROMO_CARDS.map((g) => (
        <View key={g.id} style={styles.gameCard}>
          <LinearGradient colors={[...g.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCardGrad}>
            {g.image ? (
              <Image source={g.image} style={styles.gameCardImage} contentFit="cover" />
            ) : (
              <View style={styles.gameIconFallback}>
                <GameIconForPromo id={g.id} size={72} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(5,2,14,0.92)']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0.35 }}
              end={{ x: 0.5, y: 1 }}
            />
            <View style={styles.gameCardCopy}>
              <Text style={styles.gameTitle}>{g.title}</Text>
              <Text style={styles.gameTag}>{g.tagline}</Text>
              {g.bullets.map((b, bi) => (
                <Text key={`${g.id}-g${bi}`} style={styles.gameBullet}>
                  • {b}
                </Text>
              ))}
            </View>
          </LinearGradient>
        </View>
      ))}

      <Text style={styles.sectionLabel}>{DAILY_TOURNAMENT_PROMO.title}</Text>
      <View style={styles.dailyCard}>
        <LinearGradient
          colors={['rgba(250,204,21,0.35)', 'rgba(45,212,191,0.25)', 'rgba(255,0,110,0.2)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dailyBorder}
        >
          <View style={styles.dailyInner}>
            <View style={styles.dailyHeaderRow}>
              <SafeIonicons name="trophy" size={28} color={PROMO_LIME} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dailyKicker}>{DAILY_TOURNAMENT_PROMO.kicker}</Text>
                <Text style={styles.dailyTitle}>Daily bracket energy for Stories</Text>
              </View>
            </View>
            {DAILY_TOURNAMENT_PROMO.bullets.map((b, i) => (
              <Text key={`daily-b${i}`} style={styles.dailyBullet}>
                {b}
              </Text>
            ))}
            <Text style={styles.dailyFoot}>
              Tip: screen-record the “Next round” overlay + score tick for a 15s Reel.
            </Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.tipCard}>
        <SafeIonicons name="logo-instagram" size={22} color={runit.neonPink} />
        <Text style={styles.tipTxt}>
          Export: screenshot this page or record in-app. Tagline idea — “Skill arcade. Real matchups. Play Run iT.”
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  backTxt: { color: PROMO_TEAL, fontSize: 15, fontWeight: '700' },
  internalBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    marginBottom: 16,
  },
  internalBannerTxt: {
    flex: 1,
    color: 'rgba(254,249,195,0.92)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  pageTitle: {
    color: '#f8fafc',
    fontSize: 26,
    letterSpacing: 2,
    marginBottom: 6,
  },
  pageSub: {
    color: 'rgba(203,213,225,0.88)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    color: PROMO_GREEN,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  sectionHint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  pager: { marginHorizontal: -16, marginBottom: 8 },
  slidePage: {
    paddingHorizontal: 16,
  },
  slideCardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.35)',
  },
  slideCardInner: {
    borderRadius: 19,
    overflow: 'hidden',
  },
  slideImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#0f172a',
  },
  slideTextBlock: {
    padding: 16,
  },
  slideKicker: {
    color: PROMO_TEAL,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  slideTitle: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  slideBody: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  pagerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 28, backgroundColor: PROMO_TEAL },
  dotInactive: { width: 8, backgroundColor: 'rgba(148,163,184,0.35)' },
  pagerNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  nextCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  nextCtaTxt: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  gameCard: {
    marginBottom: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,0,110,0.25)',
  },
  gameCardGrad: {
    minHeight: 280,
    position: 'relative',
  },
  gameCardImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  gameIconFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
  },
  gameCardCopy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
  },
  gameTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  gameTag: {
    color: PROMO_LIME,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 10,
  },
  gameBullet: {
    color: 'rgba(248,250,252,0.95)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 4,
  },
  dailyCard: { marginBottom: 20 },
  dailyBorder: {
    borderRadius: 18,
    padding: 2,
  },
  dailyInner: {
    backgroundColor: 'rgba(8,4,18,0.94)',
    borderRadius: 16,
    padding: 16,
  },
  dailyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dailyKicker: {
    color: PROMO_TEAL,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  dailyTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  dailyBullet: {
    color: 'rgba(226,232,240,0.92)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 8,
  },
  dailyFoot: {
    marginTop: 8,
    color: 'rgba(148,163,184,0.9)',
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,0,110,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,0,110,0.22)',
    marginBottom: 24,
  },
  tipTxt: {
    flex: 1,
    color: 'rgba(226,232,240,0.9)',
    fontSize: 13,
    lineHeight: 19,
  },
});
