import { memo, type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import type { BracketPathCell } from '@/lib/fakeBracketPathModel';
import { runit, runitFont, runitTextGlowPink } from '@/lib/runitArcadeTheme';

export type BracketPathEventBadge = {
  title: string;
  subtitle: string;
};

export type BracketPathStats = {
  fieldPlayers: number;
  eventDateLine: string;
  championLine: string;
};

type Props = {
  /** Large headline (e.g. YOUR BRACKET). */
  heroTitle: string;
  heroSubtitle: string;
  eventBadge?: BracketPathEventBadge;
  title: string;
  subtitle?: string;
  cells: BracketPathCell[];
  youName: string;
  /**
   * When true, rounds you have not reached yet do not show your display name as if you had already advanced.
   */
  maskFutureYou?: boolean;
  bracketStats?: BracketPathStats;
  disclaimerText?: string;
};

const NEON_WIN = '#22ffc4';
const PATH_FUTURE = '#f59e0b';
const PATH_DIM = 'rgba(100,116,139,0.35)';

function CardFace({
  cell,
  youName,
  maskFutureYou,
}: {
  cell: BracketPathCell;
  youName: string;
  maskFutureYou: boolean;
}) {
  const isUpcoming = cell.status === 'upcoming';
  const isLost = cell.status === 'lost';
  const isSkipped = cell.status === 'skipped';
  const isLive = cell.status === 'live';
  const won = cell.status === 'won';
  const dim = isLost || isSkipped || isUpcoming;

  const showYouByName = !maskFutureYou || won || isLive || isLost;
  const youLabel = showYouByName ? youName.toUpperCase() : 'YOUR SLOT';

  const isQuarterish =
    /\bquarter\b/i.test(cell.roundLabel) ||
    /\bsemi\b/i.test(cell.roundLabel) ||
    /\bgrand\b/i.test(cell.roundLabel);

  return (
    <View
      style={[
        styles.cardOuter,
        dim && styles.cardOuterDim,
        isLive && styles.cardOuterLive,
        won && styles.cardOuterWon,
      ]}
    >
      <LinearGradient
        colors={
          isLive
            ? ['rgba(6,78,59,0.95)', 'rgba(15,118,110,0.9)', 'rgba(6,95,70,0.92)']
            : won
              ? ['rgba(59,7,100,0.92)', 'rgba(109,40,217,0.88)', 'rgba(30,27,75,0.95)']
              : ['rgba(15,23,42,0.95)', 'rgba(30,27,75,0.92)', 'rgba(2,6,23,0.98)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGrad}
      >
        {isLive ? (
          <View style={styles.liveTopBadge}>
            <Text style={styles.liveTopDot}>●</Text>
            <Text style={styles.liveTopTxt}> LIVE MATCH</Text>
          </View>
        ) : isUpcoming ? (
          <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingBadgeTxt}>UPCOMING</Text>
          </View>
        ) : won ? (
          <View style={styles.wonBadge}>
            <Text style={styles.wonBadgeTxt}>WIN</Text>
          </View>
        ) : (
          <View style={{ height: 18 }} />
        )}

        <View style={styles.namePill}>
          <Text style={[styles.namePillTxt, dim && !isLive && styles.pillDim]} numberOfLines={1}>
            {youLabel}
          </Text>
        </View>
        <View style={styles.avatarPlaceholder}>
          {won ? (
            <View style={styles.checkBadge}>
              <SafeIonicons name="checkmark" size={14} color="#fff" />
            </View>
          ) : null}
          {isQuarterish ? (
            <Text style={styles.laurelTrophy} accessibilityLabel="High stakes round">
              🏆
            </Text>
          ) : null}
          <SafeIonicons name="person" size={36} color={dim ? 'rgba(148,163,184,0.35)' : 'rgba(226,232,240,0.9)'} />
        </View>
        <View style={[styles.namePill, styles.oppPill]}>
          <Text
            style={[styles.namePillTxt, (isLost || dim) && styles.oppDim]}
            numberOfLines={1}
          >
            {cell.opponentName.toUpperCase()}
          </Text>
        </View>
        {isLive ? (
          <LinearGradient colors={[NEON_WIN, '#16a34a']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.yourMatchBtn}>
            <Text style={styles.yourMatchBtnTxt}>YOUR MATCH</Text>
          </LinearGradient>
        ) : null}
      </LinearGradient>
    </View>
  );
}

type ConnTone = 'win' | 'future' | 'dim';

const Connector = memo(function Connector({ tall, tone }: { tall: boolean; tone: ConnTone }) {
  const h = tall ? 140 : 100;
  const d = tall ? 'M4 2 L4 62 L38 62 L38 138' : 'M4 2 L4 42 L38 42 L38 98';
  const strokeOuter =
    tone === 'win' ? 'rgba(34,255,196,0.35)' : tone === 'dim' ? PATH_DIM : 'rgba(245,158,11,0.45)';
  const strokeInner =
    tone === 'win' ? NEON_WIN : tone === 'dim' ? 'rgba(71,85,105,0.5)' : PATH_FUTURE;
  const strokeW = tone === 'win' ? 5 : 4;
  const strokeW2 = tone === 'win' ? 2.5 : 2;
  return (
    <View style={[styles.connWrap, { height: h }]}>
      <Svg width={44} height={h} viewBox={`0 0 44 ${h}`}>
        <Path
          d={d}
          stroke={strokeOuter}
          strokeWidth={strokeW}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={d}
          stroke={strokeInner}
          strokeWidth={strokeW2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
});

function connectorToneAfter(cell: BracketPathCell | undefined): ConnTone {
  if (!cell) return 'future';
  if (cell.status === 'won') return 'win';
  if (cell.status === 'lost' || cell.status === 'skipped') return 'dim';
  return 'future';
}

function StatsRow({ stats }: { stats: BracketPathStats }) {
  const items: { icon: ComponentProps<typeof SafeIonicons>['name']; line1: string; line2: string }[] = [
    { icon: 'people-outline', line1: `${stats.fieldPlayers.toLocaleString()}`, line2: 'Total Players' },
    { icon: 'calendar-outline', line1: stats.eventDateLine, line2: 'Event Date' },
    { icon: 'trophy-outline', line1: stats.championLine, line2: 'Champion' },
    { icon: 'ticket-outline', line1: 'Win Tickets', line2: 'Redeem in Prizes' },
  ];
  return (
    <View style={styles.statsOuter}>
      <View style={styles.statsRow}>
        {items.map((it) => (
          <View key={it.line2} style={styles.statCell}>
            <SafeIonicons name={it.icon} size={18} color="rgba(196,181,253,0.95)" />
            <Text style={styles.statLine1} numberOfLines={1}>
              {it.line1}
            </Text>
            <Text style={styles.statLine2}>{it.line2}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function BracketPathBoard({
  heroTitle,
  heroSubtitle,
  eventBadge,
  title,
  subtitle,
  cells,
  youName,
  maskFutureYou = true,
  bracketStats,
  disclaimerText,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.heroRow}>
        <View style={styles.heroTextCol}>
          <Text style={[styles.heroTitle, { fontFamily: runitFont.black }, runitTextGlowPink]}>{heroTitle}</Text>
          <Text style={styles.heroSub}>{heroSubtitle}</Text>
        </View>
        {eventBadge ? (
          <LinearGradient
            colors={['rgba(76,29,149,0.95)', 'rgba(49,46,129,0.88)']}
            style={styles.eventBadge}
          >
            <SafeIonicons name="trophy" size={22} color={runit.gold} />
            <Text style={styles.eventBadgeTitle}>{eventBadge.title}</Text>
            <Text style={styles.eventBadgeSub}>{eventBadge.subtitle}</Text>
          </LinearGradient>
        ) : null}
      </View>

      <Text style={[styles.sectionTitle, { fontFamily: runitFont.black }]}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cells.map((cell, i) => (
          <View key={cell.roundIndex1Based} style={styles.col}>
            <Text style={styles.roundLbl}>{cell.roundLabel.toUpperCase()}</Text>
            <CardFace cell={cell} youName={youName} maskFutureYou={maskFutureYou} />
            {i < cells.length - 1 ? (
              <Connector tall={cells.length <= 6} tone={connectorToneAfter(cell)} />
            ) : null}
          </View>
        ))}
        <View style={styles.trophyCol}>
          <Text style={styles.roundLbl}>CHAMPION</Text>
          <LinearGradient colors={['rgba(30,27,75,0.95)', 'rgba(15,23,42,0.98)']} style={styles.trophyCard}>
            <Text style={styles.laurelLarge}>🏆</Text>
            <Text style={styles.trophyHint}>Final prize</Text>
          </LinearGradient>
        </View>
        <View style={styles.scrollEndChevron} accessibilityLabel="Scroll for more">
          <LinearGradient colors={[runit.neonPurple, '#4c1d95']} style={styles.scrollEndInner}>
            <SafeIonicons name="chevron-forward" size={22} color="#fff" />
          </LinearGradient>
        </View>
      </ScrollView>

      <View style={styles.swipeHintRow}>
        <SafeIonicons name="hand-left-outline" size={16} color="rgba(148,163,184,0.85)" />
        <Text style={styles.swipeHint}>Swipe sideways to see the full path</Text>
      </View>

      {bracketStats ? <StatsRow stats={bracketStats} /> : null}

      {disclaimerText ? (
        <View style={styles.disclaimer}>
          <SafeIonicons name="information-circle-outline" size={20} color={runit.gold} />
          <Text style={styles.disclaimerTxt}>{disclaimerText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 4 },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
  heroTextCol: { flex: 1, minWidth: 0 },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 26,
    fontStyle: 'italic',
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroSub: { color: 'rgba(148,163,184,0.95)', fontSize: 13, lineHeight: 20 },
  eventBadge: {
    width: 118,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.55)',
    alignItems: 'center',
    gap: 4,
  },
  eventBadgeTitle: {
    color: '#f8fafc',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  eventBadgeSub: {
    color: 'rgba(226,232,240,0.88)',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  sectionTitle: { color: '#f8fafc', fontSize: 16, letterSpacing: 1.1, marginBottom: 4 },
  sub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  scrollContent: {
    paddingVertical: 8,
    paddingRight: 8,
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  col: { alignItems: 'center', width: 148, marginRight: 2 },
  roundLbl: {
    color: 'rgba(196,181,253,0.92)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 8,
    textAlign: 'center',
  },
  cardOuter: {
    width: 132,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.28)',
    ...Platform.select({
      web: { boxShadow: '0 10px 28px rgba(0,0,0,0.4)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
        elevation: 10,
      },
    }),
  },
  cardOuterDim: { opacity: 0.52 },
  cardOuterLive: {
    borderColor: NEON_WIN,
    borderWidth: 2,
    ...Platform.select({
      web: { boxShadow: `0 0 22px ${NEON_WIN}55` } as object,
      default: {
        shadowColor: NEON_WIN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
        elevation: 14,
      },
    }),
  },
  cardOuterWon: {
    borderColor: 'rgba(167,139,250,0.55)',
  },
  cardGrad: { paddingBottom: 10, paddingTop: 6, paddingHorizontal: 8, minHeight: 176 },
  liveTopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 6,
  },
  liveTopDot: { color: NEON_WIN, fontSize: 11, fontWeight: '900' },
  liveTopTxt: { color: NEON_WIN, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  upcomingBadge: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    marginBottom: 6,
  },
  upcomingBadgeTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  wonBadge: {
    alignSelf: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
    marginBottom: 6,
  },
  wonBadgeTxt: { color: '#86efac', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  namePill: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  oppPill: { marginTop: 6, marginBottom: 0 },
  namePillTxt: { color: '#f8fafc', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pillDim: { color: 'rgba(148,163,184,0.85)' },
  oppDim: { color: 'rgba(148,163,184,0.75)' },
  avatarPlaceholder: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  laurelTrophy: {
    position: 'absolute',
    left: 4,
    top: 2,
    fontSize: 18,
    opacity: 0.88,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourMatchBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  yourMatchBtnTxt: { color: '#052e16', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  connWrap: { width: 44, height: 100, marginHorizontal: -4, justifyContent: 'center' },
  trophyCol: { width: 112, alignItems: 'center', marginLeft: 4 },
  trophyCard: {
    width: 108,
    minHeight: 176,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  laurelLarge: { fontSize: 40 },
  trophyHint: { color: 'rgba(148,163,184,0.85)', fontSize: 10, fontWeight: '700' },
  scrollEndChevron: { justifyContent: 'center', paddingLeft: 4, marginRight: 4 },
  scrollEndInner: {
    width: 36,
    height: 120,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.45)',
  },
  swipeHintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  swipeHint: { fontSize: 11, color: 'rgba(148,163,184,0.82)', flex: 1 },
  statsOuter: {
    marginTop: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  statCell: {
    width: '47%',
    minWidth: 140,
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  statLine1: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  statLine2: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '700',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(253,224,71,0.45)',
    backgroundColor: 'rgba(15,23,42,0.65)',
  },
  disclaimerTxt: { flex: 1, color: 'rgba(226,232,240,0.9)', fontSize: 12, lineHeight: 18, fontWeight: '600' },
});
