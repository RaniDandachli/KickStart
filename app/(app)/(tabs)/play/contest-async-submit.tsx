import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { normalizeH2hSkillContestGameKey, supportsClientAsyncHostQueue } from '@/lib/h2hSkillContestGames';
import type { QueueKind } from '@/store/matchmakingStore';
import type { AsyncH2hQueueSubmit } from '@/types/match';

import BallRunGame from '@/minigames/ballrun/BallRunGame';
import CyberRoadScreen from '@/minigames/cyberroad/CyberRoadScreen';
import DashDuelScreen from '@/minigames/dashduel/DashDuelScreen';
import NeonDanceGame from '@/minigames/neondance/NeonDanceGame';
import NeonGridScreen from '@/minigames/neongrid/NeonGridScreen';
import NeonShipScreen from '@/minigames/neonship/NeonShipScreen';
import TapDashGame from '@/minigames/tapdash/TapDashGame';
import TileClashGame from '@/minigames/tileclash/TileClashGame';
import TurboArenaGame from '@/minigames/turboarenagame/TurboArenagame';

function firstParam(v: string | string[] | undefined): string {
  if (v == null) return '';
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

export default function ContestAsyncSubmitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    asyncStake?: string | string[];
    gameKey?: string | string[];
    h2hMode?: string | string[];
    entryCents?: string | string[];
    prizeCents?: string | string[];
  }>();

  const asyncBundle: AsyncH2hQueueSubmit | undefined = useMemo(() => {
    const stake = firstParam(params.asyncStake);
    if (stake !== '1' && stake !== 'true') return undefined;
    const gkRaw = firstParam(params.gameKey);
    const gk = normalizeH2hSkillContestGameKey(gkRaw);
    if (!gk || !supportsClientAsyncHostQueue(gk)) return undefined;
    const ec = parseInt(firstParam(params.entryCents), 10);
    const pc = parseInt(firstParam(params.prizeCents), 10);
    if (!Number.isFinite(ec) || ec < 0 || !Number.isFinite(pc) || pc < 0) return undefined;
    const hm = firstParam(params.h2hMode);
    const qm: QueueKind = hm === 'ranked' ? 'ranked' : hm === 'custom' ? 'custom' : 'casual';
    return { gameKey: gk, mode: qm, entryFeeWalletCents: ec, listedPrizeUsdCents: pc };
  }, [params.asyncStake, params.gameKey, params.h2hMode, params.entryCents, params.prizeCents]);

  if (!asyncBundle) {
    return (
      <Screen scroll>
        <Text className="text-base font-semibold text-white">Invalid async contest link</Text>
        <Text className="mt-2 text-sm text-slate-400">Open this flow from the contest queue with a supported minigame and tier.</Text>
        <AppButton className="mt-6" title="Back to Arcade" onPress={() => router.replace('/(app)/(tabs)/play')} />
      </Screen>
    );
  }

  const g = asyncBundle.gameKey;

  const body = (() => {
    switch (g) {
      case 'tap-dash':
        return <TapDashGame playMode="practice" asyncH2hQueueSubmit={asyncBundle} />;
      case 'tile-clash':
        return <TileClashGame playMode="practice" asyncH2hQueueSubmit={asyncBundle} weeklyRace={false} />;
      case 'ball-run':
        return <BallRunGame playMode="practice" asyncH2hQueueSubmit={asyncBundle} />;
      case 'dash-duel':
        return <DashDuelScreen asyncH2hQueueSubmit={asyncBundle} />;
      case 'turbo-arena':
        return <TurboArenaGame playMode="practice" asyncH2hQueueSubmit={asyncBundle} />;
      case 'neon-dance':
        return <NeonDanceGame playMode="practice" asyncH2hQueueSubmit={asyncBundle} />;
      case 'neon-grid':
        return <NeonGridScreen asyncH2hQueueSubmit={asyncBundle} />;
      case 'neon-ship':
        return <NeonShipScreen asyncH2hQueueSubmit={asyncBundle} />;
      case 'cyber-road':
        return <CyberRoadScreen asyncH2hQueueSubmit={asyncBundle} />;
      default:
        return null;
    }
  })();

  if (!body) {
    return (
      <Screen scroll>
        <Text className="text-base font-semibold text-white">Unsupported here</Text>
        <Text className="mt-2 text-sm text-slate-400">This minigame is not available for async submit from this screen yet.</Text>
        <AppButton className="mt-6" title="Back to Arcade" onPress={() => router.replace('/(app)/(tabs)/play')} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {body}
    </View>
  );
}
