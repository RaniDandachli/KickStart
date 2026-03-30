export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'user' | 'admin' | 'moderator';
export type TournamentState = 'draft' | 'open' | 'full' | 'locked' | 'active' | 'completed' | 'cancelled';
export type TournamentFormat = 'single_elimination' | 'round_robin';
export type EntryType = 'free' | 'credits' | 'sponsor';
export type TransactionKind =
  | 'credit_earn'
  | 'credit_spend'
  | 'gem_earn'
  | 'gem_spend'
  | 'reward_grant'
  | 'cosmetic_purchase'
  | 'subscription_event'
  | 'admin_adjustment'
  | 'prize_credit_earn'
  | 'prize_credit_spend'
  | 'redeem_ticket_spend';

type PublicTable<
  Row extends Record<string, unknown>,
  Insert extends Record<string, unknown>,
  Update extends Record<string, unknown>,
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  region: string;
  suspended_until: string | null;
  cheating_review_flag: boolean;
  /** Cash wallet: head-to-head entry fees, tournament entry, withdrawals (cents). */
  wallet_cents: number;
  /** Arcade play currency (prize run entry); not for catalog redemption. */
  prize_credits: number;
  /** Prizes catalog only; separate from prize credits. */
  redeem_tickets: number;
  /** JSON object — see `ShippingAddress` in app code. */
  shipping_address: Json | null;
  gems: number;
  created_at: string;
  updated_at: string;
};

export type SeasonRow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RatingRow = {
  id: string;
  user_id: string;
  season_id: string | null;
  queue_mode: 'ranked' | 'casual';
  rating: number;
  games_played: number;
  provisional_games_remaining: number;
  created_at: string;
  updated_at: string;
};

export type TournamentRow = {
  id: string;
  creator_id: string | null;
  season_id: string | null;
  name: string;
  description: string | null;
  state: TournamentState;
  format: TournamentFormat;
  entry_type: EntryType;
  /** Entry fee from cash wallet (cents), not arcade prize credits. */
  entry_fee_wallet_cents: number;
  prize_description: string;
  max_players: number;
  current_player_count: number;
  rules_summary: string | null;
  starts_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TournamentRuleRow = {
  id: string;
  tournament_id: string;
  sort_order: number;
  title: string;
  body: string;
  created_at: string;
};

export type MatchSessionRow = {
  id: string;
  mode: 'casual' | 'ranked' | 'custom';
  status: string;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_user_id: string | null;
  score_a: number;
  score_b: number;
  suspicious_flag: boolean;
  verification_status: string;
  dispute_status: string;
  evidence_notes: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserStatsRow = {
  user_id: string;
  wins: number;
  losses: number;
  current_streak: number;
  best_streak: number;
  matches_played: number;
  updated_at: string;
};

export type LeaderboardSnapshotRow = {
  id: string;
  season_id: string | null;
  scope: 'global' | 'regional' | 'friends';
  region: string;
  user_id: string;
  rank: number;
  rating: number;
  wins: number;
  win_rate: number | null;
  streak: number;
  rank_delta: number;
  captured_at: string;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  kind: TransactionKind;
  amount: number;
  currency: 'wallet_cents' | 'gems' | 'prize_credits' | 'redeem_tickets';
  description: string;
  metadata: Json;
  created_at: string;
};

export type CosmeticRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  rarity: string;
  price_credits: number | null;
  price_gems: number | null;
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type PrizeCatalogRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string;
  cost_redeem_tickets: number;
  sort_order: number;
  is_active: boolean;
  stock_remaining: number | null;
  requires_shipping: boolean;
  created_at: string;
  updated_at: string;
};

export type PrizeRedemptionRow = {
  id: string;
  user_id: string;
  prize_catalog_id: string;
  redeem_tickets_spent: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  shipping_snapshot: Json | null;
  created_at: string;
};

type TournamentEntryRow = {
  id: string;
  tournament_id: string;
  user_id: string;
  status: string;
  joined_at: string;
};

type TournamentRoundRow = {
  id: string;
  tournament_id: string;
  round_index: number;
  label: string;
  created_at: string;
};

type TournamentMatchRow = {
  id: string;
  tournament_id: string;
  round_id: string;
  match_index: number;
  player_a_id: string | null;
  player_b_id: string | null;
  winner_id: string | null;
  next_match_id: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

type MatchResultRow = {
  id: string;
  match_session_id: string | null;
  tournament_match_id: string | null;
  winner_user_id: string | null;
  loser_user_id: string | null;
  score: Json;
  ranked_rating_delta: Json | null;
  was_ranked: boolean;
  audit_ref: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan_key: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  read_at: string | null;
  data: Json;
  created_at: string;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  target_user_id: string | null;
  match_session_id: string | null;
  category: string;
  details: string | null;
  status: string;
  created_at: string;
};

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  payload: Json;
  created_at: string;
};

type AchievementRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_key: string;
  created_at: string;
};

/** Arcade / single-player scores (see `submitMinigameScore` Edge Function for validation). */
export type MinigameScoreRow = {
  id: string;
  user_id: string;
  game_type: string;
  score: number;
  duration_ms: number;
  taps: number;
  created_at: string;
};

/** Supabase `Database` generic: includes `Relationships` for postgrest-js. Regenerate via CLI when schema changes. */
export interface Database {
  public: {
    Tables: {
      profiles: PublicTable<
        ProfileRow,
        Pick<ProfileRow, 'id' | 'username'> & Partial<Omit<ProfileRow, 'id' | 'username'>>,
        Partial<Omit<ProfileRow, 'id' | 'created_at'>>
      >;
      seasons: PublicTable<SeasonRow, Partial<SeasonRow>, Partial<SeasonRow>>;
      ratings: PublicTable<RatingRow, Partial<RatingRow>, Partial<RatingRow>>;
      tournaments: PublicTable<TournamentRow, Partial<TournamentRow>, Partial<TournamentRow>>;
      tournament_rules: PublicTable<
        TournamentRuleRow,
        Pick<TournamentRuleRow, 'tournament_id' | 'title' | 'body'> & Partial<Omit<TournamentRuleRow, 'tournament_id' | 'title' | 'body'>>,
        Partial<Omit<TournamentRuleRow, 'id' | 'created_at'>>
      >;
      tournament_entries: PublicTable<
        TournamentEntryRow,
        Pick<TournamentEntryRow, 'tournament_id' | 'user_id'> & Partial<Pick<TournamentEntryRow, 'status'>>,
        Partial<Pick<TournamentEntryRow, 'status'>>
      >;
      tournament_rounds: PublicTable<
        TournamentRoundRow,
        Partial<TournamentRoundRow>,
        Partial<TournamentRoundRow>
      >;
      tournament_matches: PublicTable<
        TournamentMatchRow,
        Partial<TournamentMatchRow>,
        Partial<TournamentMatchRow>
      >;
      match_sessions: PublicTable<MatchSessionRow, Partial<MatchSessionRow>, Partial<MatchSessionRow>>;
      match_results: PublicTable<MatchResultRow, Partial<MatchResultRow>, Partial<MatchResultRow>>;
      minigame_scores: PublicTable<
        MinigameScoreRow,
        Pick<MinigameScoreRow, 'user_id' | 'game_type' | 'score' | 'duration_ms' | 'taps'>,
        Partial<Pick<MinigameScoreRow, 'score' | 'duration_ms' | 'taps'>>
      >;
      user_stats: PublicTable<UserStatsRow, Partial<UserStatsRow>, Partial<UserStatsRow>>;
      leaderboard_snapshots: PublicTable<
        LeaderboardSnapshotRow,
        Partial<LeaderboardSnapshotRow>,
        Partial<LeaderboardSnapshotRow>
      >;
      achievements: PublicTable<
        AchievementRow,
        Pick<AchievementRow, 'slug' | 'name' | 'description'> & Partial<Pick<AchievementRow, 'icon_key'>>,
        Partial<Omit<AchievementRow, 'id' | 'created_at'>>
      >;
      user_achievements: PublicTable<
        { id: string; user_id: string; achievement_id: string; earned_at: string },
        Pick<{ user_id: string; achievement_id: string }, 'user_id' | 'achievement_id'>,
        Partial<{ earned_at: string }>
      >;
      cosmetics: PublicTable<CosmeticRow, Partial<CosmeticRow>, Partial<CosmeticRow>>;
      user_cosmetics: PublicTable<
        { id: string; user_id: string; cosmetic_id: string; acquired_at: string; equipped: boolean },
        Pick<{ user_id: string; cosmetic_id: string; equipped?: boolean }, 'user_id' | 'cosmetic_id'> & {
          equipped?: boolean;
        },
        Partial<{ equipped: boolean }>
      >;
      transactions: PublicTable<TransactionRow, Partial<TransactionRow>, Partial<TransactionRow>>;
      prize_catalog: PublicTable<PrizeCatalogRow, Partial<PrizeCatalogRow>, Partial<PrizeCatalogRow>>;
      prize_redemptions: PublicTable<
        PrizeRedemptionRow,
        Pick<PrizeRedemptionRow, 'user_id' | 'prize_catalog_id' | 'redeem_tickets_spent'> & Partial<
          Pick<PrizeRedemptionRow, 'status' | 'shipping_snapshot'>
        >,
        Partial<Pick<PrizeRedemptionRow, 'status' | 'shipping_snapshot'>>
      >;
      subscriptions: PublicTable<SubscriptionRow, Partial<SubscriptionRow>, Partial<SubscriptionRow>>;
      notifications: PublicTable<NotificationRow, Partial<NotificationRow>, Partial<NotificationRow>>;
      reports: PublicTable<ReportRow, Partial<ReportRow>, Partial<ReportRow>>;
      admin_audit_logs: PublicTable<AuditRow, Partial<AuditRow>, Partial<AuditRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      redeem_prize_offer: {
        Args: { p_prize_id: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
