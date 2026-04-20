import { memo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import type { BracketPathCell } from '@/lib/fakeBracketPathModel';
import { runitFont } from '@/lib/runitArcadeTheme';

type Props = {
  title: string;
  subtitle?: string;
  cells: BracketPathCell[];
  youName: string;
};

function CardFace({
  cell,
  youName,
}: {
  cell: BracketPathCell;
  youName: string;
}) {
  const dim = cell.status === 'lost' || cell.status === 'skipped' || cell.status === 'upcoming';
  const isLive = cell.status === 'live';
  const won = cell.status === 'won';

  return (
    <View style={[styles.cardOuter, dim && styles.cardOuterDim]}>
      <LinearGradient
        colors={
          isLive
            ? ['#0e7490', '#155e75', '#0c4a6e']
            : won
              ? ['#0d9488', '#0f766e', '#134e4a']
              : ['#1e3a5f', '#172554', '#0f172a']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGrad}
      >
        <View style={styles.namePill}>
          <Text style={styles.namePillTxt} numberOfLines={1}>
            {youName.toUpperCase()}
          </Text>
        </View>
        <View style={styles.avatarPlaceholder}>
          {won ? (
            <View style={styles.checkBadge}>
              <SafeIonicons name="checkmark" size={14} color="#fff" />
            </View>
          ) : null}
          <SafeIonicons name="person" size={36} color={dim ? 'rgba(148,163,184,0.35)' : 'rgba(226,232,240,0.9)'} />
        </View>
        <View style={[styles.namePill, styles.oppPill]}>
          <Text
            style={[styles.namePillTxt, (cell.status === 'lost' || dim) && styles.oppDim]}
            numberOfLines={1}
          >
            {cell.opponentName.toUpperCase()}
          </Text>
        </View>
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeTxt}>YOUR MATCH</Text>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const Connector = memo(function Connector({ tall }: { tall: boolean }) {
  const h = tall ? 140 : 100;
  const d = tall ? 'M4 2 L4 62 L38 62 L38 138' : 'M4 2 L4 42 L38 42 L38 98';
  return (
    <View style={[styles.connWrap, { height: h }]}>
      <Svg width={44} height={h} viewBox={`0 0 44 ${h}`}>
        <Path
          d={d}
          stroke="rgba(251,191,36,0.55)"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d={d}
          stroke="#22d3ee"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
});

export function BracketPathBoard({ title, subtitle, cells, youName }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { fontFamily: runitFont.black }]}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cells.map((cell, i) => (
          <View key={cell.roundIndex1Based} style={styles.col}>
            <Text style={styles.roundLbl}>{cell.roundLabel}</Text>
            <CardFace cell={cell} youName={youName} />
            {i < cells.length - 1 ? <Connector tall={cells.length <= 6} /> : null}
          </View>
        ))}
        <View style={styles.trophyCol}>
          <Text style={styles.roundLbl}>Champion</Text>
          <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.trophyCard}>
            <SafeIonicons name="trophy" size={44} color="#fbbf24" />
            <Text style={styles.trophyHint}>Final prize</Text>
          </LinearGradient>
        </View>
      </ScrollView>
      {Platform.OS === 'web' ? (
        <Text style={styles.hint}>Swipe sideways to see the full path</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { color: '#f8fafc', fontSize: 18, letterSpacing: 1.2, marginBottom: 4 },
  sub: { color: 'rgba(148,163,184,0.95)', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  scrollContent: {
    paddingVertical: 8,
    paddingRight: 24,
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  col: { alignItems: 'center', width: 148, marginRight: 4 },
  roundLbl: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardOuter: {
    width: 132,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    ...Platform.select({
      web: { boxShadow: '0 12px 36px rgba(0,0,0,0.45)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 12,
      },
    }),
  },
  cardOuterDim: { opacity: 0.55 },
  cardGrad: { paddingBottom: 10, paddingTop: 8, paddingHorizontal: 8, minHeight: 168 },
  namePill: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  oppPill: { marginTop: 6, marginBottom: 0 },
  namePillTxt: { color: '#f8fafc', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  oppDim: { color: 'rgba(148,163,184,0.75)' },
  avatarPlaceholder: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  liveBadge: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(34,211,238,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
  },
  liveBadgeTxt: { color: '#67e8f9', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  connWrap: { width: 44, height: 100, marginHorizontal: -4, justifyContent: 'center' },
  trophyCol: { width: 120, alignItems: 'center', marginLeft: 8 },
  trophyCard: {
    width: 112,
    minHeight: 168,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  trophyHint: { color: 'rgba(148,163,184,0.85)', fontSize: 10, fontWeight: '700' },
  hint: { marginTop: 10, fontSize: 11, color: 'rgba(148,163,184,0.75)' },
});
