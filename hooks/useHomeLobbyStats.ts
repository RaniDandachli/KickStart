import { useQuery } from '@tanstack/react-query';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import { queryKeys } from '@/lib/queryKeys';
import { fetchHomeLobbyStats } from '@/services/api/homeLobby';

/** Minutes since an ISO timestamp, at least 1 for display. */
export function minsAgoFromIso(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 1;
  return Math.max(1, Math.round((Date.now() - t) / 60_000));
}

const GAME_LABEL: Record<string, string> = {
  tap_dash: 'Tap Dash',
  tile_clash: 'Tile Clash',
  ball_run: 'Neon Ball Run',
  neon_ball_run: 'Neon Ball Run',
  neon_pool: 'Neon Pool',
  stacker: 'Stacker',
  turbo_arena: 'Turbo Arena',
};

function formatRewardUsd(cents: number) {
  const usd = cents / 100;
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`;
  if (usd >= 100) return `$${Math.round(usd)}`;
  if (usd >= 1) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

export function buildTickerLinesFromLobby(
  rewards: { username: string; cents: number; created_at: string }[],
  arcade: { username: string; score: number; game_type: string; created_at: string }[],
): string[] {
  const lines: string[] = [];
  for (const r of rewards.slice(0, 16)) {
    const m = minsAgoFromIso(r.created_at);
    lines.push(`${r.username} earned ${formatRewardUsd(r.cents)} · ${m} min ago`);
  }
  for (const a of arcade.slice(0, 16)) {
    if (lines.length >= 14) break;
    const game = GAME_LABEL[a.game_type] ?? a.game_type.replace(/_/g, ' ');
    const m = minsAgoFromIso(a.created_at);
    lines.push(`${a.username} · ${a.score} ${game} · ${m} min ago`);
  }
  return lines;
}

export function useHomeLobbyStats() {
  return useQuery({
    queryKey: queryKeys.homeLobby(),
    queryFn: fetchHomeLobbyStats,
    enabled: ENABLE_BACKEND,
    staleTime: 15_000,
    refetchInterval: 25_000,
    retry: 1,
  });
}
