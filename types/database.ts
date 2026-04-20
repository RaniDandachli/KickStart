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
  | 'redeem_ticket_spend'
  | 'wallet_withdraw'
  /** Cash wallet debit for H2H contest access (collected by operator; not peer-to-peer). */
  | 'h2h_contest_entry'
  /** Wallet credit when both players leave paid H2H before play (lobby abandon). */
  | 'h2h_contest_entry_refund'
  | 'tournament_entry'
  | 'tournament_prize_grant';

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
  /** Cash wallet (withdrawable when payouts supported): contest access, tournaments, withdrawals — cents. */
  wallet_cents: number;
  /** Arcade Credits — gameplay-only (`user_wallet.arcade_credit_balance` equivalent); prize runs, H2H loss consolation; not cash. */
  prize_credits: number;
  /** UTC YYYY-MM-DD when `claim_daily_prize_credits` last ran; null on legacy rows. */
  last_daily_claim_ymd: string | null;
  expo_push_token: string | null;
  expo_push_token_updated_at: string | null;
  push_notify_match_invites: boolean;
  push_notify_tournament_of_day: boolean;
  push_notify_daily_credits: boolean;
  push_notify_h2h_open_slots: boolean;
  /** `{ enabled, entryCents[], gameKeys: string[] | null }` — see `h2hOpenMatchWatchScan`. */
  h2h_open_slot_watch: Json | null;
  last_daily_credits_push_sent_ymd: string | null;
  last_tournament_of_day_push_sent_ymd: string | null;
  /** Prize catalog progress currency (`user_wallet.ticket_balance` equivalent); separate from Arcade Credits. */
  redeem_tickets: number;
  /** ISO 3166-1 alpha-2 residence for payouts (Stripe Connect); distinct from `region` (matchmaking). */
  country_code: string | null;
  /** JSON object — see `ShippingAddress` in app code. */
  shipping_address: Json | null;
  gems: number;
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  /** Whop Company id (`biz_…`) for connected-account payout portal; server-managed. */
  whop_company_id: string | null;
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
  /** When true, joins do not cap at max_players; brackets run in waves of bracket_pod_size (or max_players). */
  unlimited_entrants?: boolean;
  /** Entrants per bracket wave (e.g. 8) when unlimited_entrants is set. */
  bracket_pod_size?: number | null;
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
  /** Minigame key for this 1v1 (e.g. tap-dash). */
  game_key: string | null;
  entry_fee_wallet_cents: number;
  listed_prize_usd_cents: number | null;
  metadata: Json;
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

/** Gift-card rewards link to reward_catalog; redeem via Edge Function redeem-gift-card (not redeem_prize_offer). */
export type RewardCatalogRow = {
  id: string;
  reward_key: string;
  reward_name: string;
  brand: string;
  value_amount: number;
  currency: string;
  ticket_cost: number;
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
  /** When set, shop row is a gift card — use redeem-gift-card Edge Function. */
  reward_catalog_id?: string | null;
};

/** Prize row from `fetchActivePrizeCatalog` (nested reward_catalog). */
export type PrizeCatalogWithReward = PrizeCatalogRow & {
  reward_catalog?: RewardCatalogRow | null;
};

export type PrizeRedemptionRow = {
  id: string;
  user_id: string;
  prize_catalog_id: string;
  redeem_tickets_spent: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
  shipping_snapshot: Json | null;
  created_at: string;
  gift_card_inventory_id?: string | null;
  email_to?: string | null;
  email_status?: 'pending' | 'sent' | 'failed';
  email_error?: string | null;
  idempotency_key?: string | null;
};

type TournamentEntryRow = {
  id: string;
  tournament_id: string;
  user_id: string;
  status: string;
  joined_at: string;
  bracket_pod_index?: number | null;
};

export type TournamentRoundRow = {
  id: string;
  tournament_id: string;
  bracket_pod_index: number;
  round_index: number;
  label: string;
  created_at: string;
};

export type TournamentMatchRow = {
  id: string;
  tournament_id: string;
  bracket_pod_index: number;
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
  /** Official H2H run when set (validated `submitMinigameScore`). */
  match_session_id: string | null;
  created_at: string;
};

/** Daily solo challenge run counter (`solo_challenge_consume_try`); clients may SELECT own rows only. */
type SoloChallengeDailyAttemptRow = {
  user_id: string;
  challenge_id: string;
  calendar_day: string;
  attempts: number;
  updated_at: string;
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
        Pick<MinigameScoreRow, 'user_id' | 'game_type' | 'score' | 'duration_ms' | 'taps'> &
          Partial<Pick<MinigameScoreRow, 'match_session_id'>>,
        Partial<Pick<MinigameScoreRow, 'score' | 'duration_ms' | 'taps'>>
      >;
      solo_challenge_daily_attempts: PublicTable<
        SoloChallengeDailyAttemptRow,
        never,
        never
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
      reward_catalog: PublicTable<RewardCatalogRow, Partial<RewardCatalogRow>, Partial<RewardCatalogRow>>;
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
      redeem_gift_card_offer: {
        Args: { p_reward_key: string; p_idempotency_key?: string | null };
        Returns: Json;
      };
      claim_daily_prize_credits: {
        Args: Record<string, never>;
        Returns: Json;
      };
      home_lobby_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      home_h2h_queue_board: {
        Args: Record<string, never>;
        Returns: {
          queue_entry_id: string;
          game_key: string;
          entry_fee_wallet_cents: number;
          listed_prize_usd_cents: number;
          host_display_name: string;
          created_at: string;
        }[];
      };
      profile_fight_stats: {
        Args: { p_user_id: string };
        Returns: {
          wins: number;
          losses: number;
          current_streak: number;
          best_streak: number;
          matches_played: number;
          wins_rank: number;
        }[];
      };
      recent_match_feed: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      fulfill_stripe_checkout_session: {
        Args: {
          p_user_id: string;
          p_checkout_session_id: string;
          p_wallet_cents_add: number;
          p_prize_credits_add: number;
          p_description: string;
          p_stripe_event_id: string;
        };
        Returns: Json;
      };
      fulfill_stripe_payment_intent: {
        Args: {
          p_user_id: string;
          p_payment_intent_id: string;
          p_wallet_cents_add: number;
          p_prize_credits_add: number;
          p_description: string;
          p_stripe_event_id: string;
        };
        Returns: Json;
      };
      fulfill_whop_payment: {
        Args: {
          p_user_id: string;
          p_payment_id: string;
          p_wallet_cents_add: number;
          p_prize_credits_add: number;
          p_description: string;
          p_whop_event_id: string | null;
        };
        Returns: Json;
      };
      join_tournament: {
        Args: { p_tournament_id: string };
        Returns: Json;
      };
      admin_award_tournament_prize: {
        Args: {
          p_tournament_id: string;
          p_target_user_id: string;
          p_wallet_cents: number;
          p_prize_credits: number;
          p_gems: number;
          p_description: string;
        };
        Returns: Json;
      };
      grant_arcade_prize_credits: {
        Args: {
          p_amount: number;
          p_description: string;
          p_idempotency_key: string;
        };
        Returns: Json;
      };
      h2h_create_match_session_and_debit_entries: {
        Args: {
          p_initiator: string;
          p_opponent: string;
          p_mode: string;
          p_game_key: string | null;
          p_entry_fee_wallet_cents: number;
          p_listed_prize_usd_cents: number | null;
        };
        Returns: string;
      };
      h2h_enqueue_or_match: {
        Args: {
          p_mode: string;
          p_game_key: string;
          p_entry_fee_wallet_cents: number;
          p_listed_prize_usd_cents: number;
        };
        Returns: Json;
      };
      h2h_enqueue_quick_match: {
        Args: {
          p_mode: string;
          p_max_affordable_entry_cents: number;
          p_allowed_entry_cents: number[];
        };
        Returns: Json;
      };
      h2h_cancel_queue: {
        Args: Record<string, never>;
        Returns: Json;
      };
      h2h_enter_match_play: {
        Args: { p_match_session_id: string };
        Returns: Json;
      };
      h2h_abandon_match_session: {
        Args: { p_match_session_id: string };
        Returns: Json;
      };
      h2h_maintenance_expire_stale: {
        Args: Record<string, never>;
        Returns: Json;
      };
      h2h_tap_dash_scores_for_match: {
        Args: { p_match_session_id: string };
        Returns: Json;
      };
      h2h_file_match_dispute: {
        Args: { p_match_session_id: string; p_details: string };
        Returns: Json;
      };
      begin_minigame_prize_run: {
        Args: { p_game_type: string };
        Returns: Json;
      };
      solo_challenge_consume_try: {
        Args: { p_challenge_id: string; p_calendar_day: string };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
  };
}
