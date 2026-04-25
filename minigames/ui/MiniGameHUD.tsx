import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/lib/theme';

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

interface Props {
  timeLeftMs: number;
  scoreP1: number;
  scoreP2: number;
  labelP1?: string;
  labelP2?: string;
  subtitle?: string;
  /** Dense strip for landscape / immersive modes (smaller type, less padding). */
  compact?: boolean;
}

export function MiniGameHUD({
  timeLeftMs,
  scoreP1,
  scoreP2,
  labelP1 = 'You',
  labelP2 = 'AI',
  subtitle,
  compact = false,
}: Props) {
  if (compact) {
    return (
      <View style={[styles.compactWrap, { backgroundColor: theme.colors.backgroundDeep }]}>
        <View style={styles.compactRow}>
          <View style={[styles.compactSide, styles.compactSideLeft]}>
            <Text style={styles.compactLabel}>{labelP1}</Text>
            <Text style={styles.compactScore}>{Math.round(scoreP1)}</Text>
          </View>
          <View style={styles.compactCenter}>
            {subtitle ? <Text style={styles.compactSub}>{subtitle}</Text> : null}
            <Text style={styles.compactTime}>{formatTime(timeLeftMs)}</Text>
          </View>
          <View style={[styles.compactSide, styles.compactSideRight]}>
            <Text style={styles.compactLabelCyan}>{labelP2}</Text>
            <Text style={styles.compactScoreCyan}>{Math.round(scoreP2)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full px-3 pt-2 pb-1" style={{ backgroundColor: theme.colors.backgroundDeep }}>
      {subtitle ? (
        <Text className="mb-1 text-center text-xs font-bold uppercase tracking-wide text-amber-300">{subtitle}</Text>
      ) : null}
      <View className="flex-row items-center justify-between">
        <View className="min-w-[88px] rounded-2xl border-2 border-fuchsia-400 bg-fuchsia-950/80 px-3 py-2">
          <Text className="text-[10px] font-black uppercase tracking-wide text-fuchsia-200">{labelP1}</Text>
          <Text className="text-2xl font-black text-amber-300">{Math.round(scoreP1)}</Text>
        </View>
        <View className="items-center rounded-2xl border-2 border-amber-400 bg-violet-900 px-4 py-2">
          <Text className="text-[10px] font-black uppercase tracking-widest text-amber-200">Time</Text>
          <Text className="font-mono text-2xl font-black text-white">{formatTime(timeLeftMs)}</Text>
        </View>
        <View className="min-w-[88px] items-end rounded-2xl border-2 border-amber-400 bg-amber-950/80 px-3 py-2">
          <Text className="text-[10px] font-black uppercase tracking-wide text-amber-200">{labelP2}</Text>
          <Text className="text-2xl font-black text-amber-200">{Math.round(scoreP2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    width: '100%',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  compactSide: {
    minWidth: 56,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  compactSideLeft: {
    borderColor: 'rgba(232,121,249,0.55)',
    backgroundColor: 'rgba(74,4,78,0.55)',
  },
  compactSideRight: {
    borderColor: 'rgba(255,215,0,0.55)',
    backgroundColor: 'rgba(6,40,50,0.55)',
    alignItems: 'flex-end',
  },
  compactLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(251,207,232,0.95)',
    textTransform: 'uppercase',
  },
  compactLabelCyan: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(165,243,252,0.95)',
    textTransform: 'uppercase',
  },
  compactScore: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fcd34d',
    lineHeight: 22,
  },
  compactScoreCyan: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFD700',
    lineHeight: 22,
  },
  compactCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  compactSub: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(251,191,36,0.85)',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  compactTime: {
    fontFamily: 'monospace',
    fontSize: 17,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
