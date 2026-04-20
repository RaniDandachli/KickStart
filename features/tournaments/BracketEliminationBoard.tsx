import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Polyline, Stop } from 'react-native-svg';

import type { BracketProfile } from '@/services/api/tournaments';
import { runit } from '@/lib/runitArcadeTheme';
import { roundLabel } from '@/utils/bracket';

export type BracketBoardMatchInput = {
  id: string;
  roundIndex: number;
  matchIndex: number;
  playerAId: string | null;
  playerBId: string | null;
  winnerId: string | null;
};

type Props = {
  matches: BracketBoardMatchInput[];
  profileById: Map<string, BracketProfile>;
  /** Empty wireframe (no TBD/BYE copy — open slots only). */
  skeleton?: boolean;
};

const CARD_W = 172;
const CARD_H = 108;
const COL_GAP = 36;
const PAD_X = 14;
const PAD_Y = 14;
const ROW_GAP = 14;
const INNER_H_MIN = 300;

function yCenter(r: number, i: number, numRounds: number, innerTop: number, innerH: number): number {
  const n = 2 ** (numRounds - 1 - r);
  return innerTop + ((2 * i + 1) / (2 * n)) * innerH;
}

export function BracketEliminationBoard({ matches, profileById, skeleton }: Props) {
  const gradId = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  if (matches.length === 0) return null;

  const numRounds = Math.max(...matches.map((m) => m.roundIndex)) + 1;
  const roundZeroMatches = Math.max(
    1,
    matches.filter((m) => m.roundIndex === 0).length || 2 ** Math.max(0, numRounds - 1),
  );
  const neededInnerH = roundZeroMatches * CARD_H + Math.max(0, roundZeroMatches - 1) * ROW_GAP;
  const innerH = Math.max(INNER_H_MIN, neededInnerH);
  const H = innerH + PAD_Y * 2;
  const totalW = PAD_X * 2 + numRounds * CARD_W + (numRounds - 1) * COL_GAP;

  const xForRound = (r: number) => PAD_X + r * (CARD_W + COL_GAP);

  const lines: { x1: number; y1: number; xm: number; x2: number; y2: number }[] = [];
  for (let r = 0; r < numRounds - 1; r++) {
    const n = 2 ** (numRounds - 1 - r);
    for (let i = 0; i < n; i++) {
      const y1 = yCenter(r, i, numRounds, PAD_Y, innerH);
      const pi = Math.floor(i / 2);
      const y2 = yCenter(r + 1, pi, numRounds, PAD_Y, innerH);
      const x1 = xForRound(r) + CARD_W;
      const x2 = xForRound(r + 1);
      const xm = x1 + (x2 - x1) * 0.55;
      lines.push({ x1, y1, xm, x2, y2 });
    }
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.wrap}>
        <View style={[styles.headerRow, { width: totalW, paddingLeft: PAD_X }]}>
          {Array.from({ length: numRounds }).map((_, r) => (
            <View key={r} style={{ width: CARD_W, marginRight: r < numRounds - 1 ? COL_GAP : 0 }}>
              <Text style={styles.headerTxt}>{roundLabel(r, numRounds)}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.board, { width: totalW, minHeight: H }]}>
        <Svg width={totalW} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={`bracketLineGrad-${gradId}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fbbf24" stopOpacity={0.55} />
              <Stop offset="0.5" stopColor={runit.neonCyan} stopOpacity={0.65} />
              <Stop offset="1" stopColor={runit.neonPurple} stopOpacity={0.7} />
            </SvgGradient>
          </Defs>
          {lines.map((L, idx) => (
            <Polyline
              key={`ln-${idx}`}
              points={`${L.x1},${L.y1} ${L.xm},${L.y1} ${L.xm},${L.y2} ${L.x2},${L.y2}`}
              fill="none"
              stroke={`url(#bracketLineGrad-${gradId})`}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>

        {matches.map((m) => {
          const y = yCenter(m.roundIndex, m.matchIndex, numRounds, PAD_Y, innerH);
          const left = xForRound(m.roundIndex);
          const top = y - CARD_H / 2;
          return (
            <View key={m.id} style={[styles.cardAbs, { left, top, width: CARD_W, height: CARD_H }]}>
              <MatchCard
                m={m}
                profileById={profileById}
                skeleton={Boolean(skeleton)}
              />
            </View>
          );
        })}

        <View
          pointerEvents="none"
          style={[
            styles.trophyHint,
            {
              left: xForRound(numRounds - 1) + CARD_W + 4,
              top: yCenter(numRounds - 1, 0, numRounds, PAD_Y, innerH) - 14,
            },
          ]}
        >
          <Text style={styles.trophyTxt}>🏆</Text>
        </View>
      </View>
      </View>
    </ScrollView>
  );
}

function MatchCard({
  m,
  profileById,
  skeleton,
}: {
  m: BracketBoardMatchInput;
  profileById: Map<string, BracketProfile>;
  skeleton: boolean;
}) {
  const pa = m.playerAId ? profileById.get(m.playerAId) : undefined;
  const pb = m.playerBId ? profileById.get(m.playerBId) : undefined;
  const aWin = Boolean(m.winnerId && m.playerAId && m.winnerId === m.playerAId);
  const bWin = Boolean(m.winnerId && m.playerBId && m.winnerId === m.playerBId);

  const byeA = !m.playerAId && Boolean(m.playerBId) && !skeleton;
  const byeB = !m.playerBId && Boolean(m.playerAId) && !skeleton;

  return (
    <LinearGradient
      colors={['rgba(92,180,255,0.95)', 'rgba(107,140,255,0.75)', 'rgba(255,92,184,0.55)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardGrad}
    >
      <View style={styles.cardInner}>
        <PlayerSlot
          userId={m.playerAId}
          profile={pa}
          highlight={aWin}
          skeleton={skeleton}
          bye={Boolean(byeA)}
        />
        <View style={styles.divider} />
        <PlayerSlot
          userId={m.playerBId}
          profile={pb}
          highlight={bWin}
          skeleton={skeleton}
          bye={Boolean(byeB)}
        />
      </View>
    </LinearGradient>
  );
}

function PlayerSlot({
  userId,
  profile,
  highlight,
  skeleton,
  bye,
}: {
  userId: string | null;
  profile?: BracketProfile;
  highlight: boolean;
  skeleton: boolean;
  bye: boolean;
}) {
  if (bye) {
    return (
      <View style={styles.slotRow}>
        <View style={[styles.avatar, styles.avatarBye]}>
          <Text style={styles.byeTxt}>—</Text>
        </View>
        <Text style={styles.byeLabel}>BYE</Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.slotRow}>
        <View style={[styles.avatar, styles.avatarOpen]}>
          <Text style={styles.openMark}>◇</Text>
        </View>
        <Text style={styles.openLabel}>{skeleton ? 'Open' : 'Awaiting'}</Text>
      </View>
    );
  }

  const name = profile?.displayName ?? userId.slice(0, 8);
  const uri = profile?.avatarUrl ?? null;

  return (
    <View style={[styles.slotRow, highlight && styles.slotWin]}>
      {uri ? (
        <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" transition={120} />
      ) : (
        <LinearGradient colors={[runit.neonCyan, runit.neonPurple]} style={styles.avatarImg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
        </LinearGradient>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {name.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 8 },
  wrap: { alignSelf: 'flex-start' },
  headerRow: { flexDirection: 'row', marginBottom: 6 },
  headerTxt: {
    textAlign: 'center',
    color: 'rgba(147,197,253,0.95)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  board: { position: 'relative', marginVertical: 4 },
  cardAbs: { position: 'absolute' },
  cardGrad: {
    flex: 1,
    borderRadius: 14,
    padding: 1.5,
    shadowColor: '#5cb4ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  cardInner: {
    flex: 1,
    backgroundColor: 'rgba(6,10,22,0.94)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(100,170,255,0.2)',
    marginVertical: 1,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  slotWin: {
    backgroundColor: 'rgba(255,92,184,0.12)',
    borderLeftWidth: 3,
    borderLeftColor: runit.neonPink,
    paddingLeft: 5,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,180,255,0.35)',
  },
  avatarOpen: {
    borderStyle: 'dashed',
    backgroundColor: 'rgba(15,23,42,0.65)',
    borderColor: 'rgba(94,180,255,0.25)',
  },
  avatarBye: {
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  name: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  openMark: { color: 'rgba(94,180,255,0.55)', fontSize: 14, fontWeight: '700' },
  openLabel: { color: 'rgba(148,163,184,0.9)', fontSize: 11, fontWeight: '700' },
  byeTxt: { color: 'rgba(148,163,184,0.5)', fontSize: 14 },
  byeLabel: { color: 'rgba(148,163,184,0.65)', fontSize: 11, fontWeight: '700', fontStyle: 'italic' },
  trophyHint: {
    position: 'absolute',
    width: 28,
    alignItems: 'center',
  },
  trophyTxt: { fontSize: 18, opacity: 0.85 },
});
