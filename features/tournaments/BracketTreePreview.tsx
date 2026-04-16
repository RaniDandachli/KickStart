import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { roundLabel, singleEliminationRoundCount, type BracketPlayer } from '@/utils/bracket';

export interface BracketMatchPreview {
  id: string;
  roundIndex: number;
  a?: string;
  b?: string;
  winner?: string;
}

/** Read-only bracket — columns from match `roundIndex` so late rounds render when DB has full tree. */
export function BracketTreePreview({ players, matches }: { players: BracketPlayer[]; matches: BracketMatchPreview[] }) {
  const fromPlayers = singleEliminationRoundCount(players.length) || 1;
  const maxFromMatches = matches.length ? Math.max(...matches.map((m) => m.roundIndex)) + 1 : 1;
  const rounds = Math.max(fromPlayers, maxFromMatches);
  const byRound: BracketMatchPreview[][] = Array.from({ length: rounds }, () => []);
  matches.forEach((m) => {
    byRound[m.roundIndex]?.push(m);
  });

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-slate-100">Bracket</Text>
      <View className="flex-row gap-2" style={{ flexWrap: 'wrap' }}>
        {byRound.map((ms, ri) => (
          <View key={ri} className="min-w-[140px] flex-1 gap-2">
            <Text className="text-center text-xs font-semibold text-neon-cyan">
              {roundLabel(ri, rounds)}
            </Text>
            {ms.length === 0 ? (
              <Card className="border-dashed border-emerald-200">
                <Text className="text-center text-xs text-slate-400">Awaiting seeds</Text>
              </Card>
            ) : (
              ms.map((m) => (
                <Card key={m.id} className="gap-1 border-l-4 border-emerald-400">
                  <Line label={m.a ?? 'TBD'} active={m.winner === m.a} />
                  <Line label={m.b ?? 'BYE'} active={m.winner === m.b} dim={!m.b} />
                </Card>
              ))
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function Line({ label, active, dim }: { label: string; active?: boolean; dim?: boolean }) {
  return (
    <Text
      className={`text-sm ${
        active ? 'font-bold text-emerald-600' : dim ? 'text-slate-300' : 'text-slate-700'
      }`}
    >
      {label}
    </Text>
  );
}
