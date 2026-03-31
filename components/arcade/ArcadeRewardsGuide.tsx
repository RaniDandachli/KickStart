import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ENABLE_BACKEND } from '@/constants/featureFlags';
import {
  PRIZE_RUN_ENTRY_CREDITS,
  TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS,
  DAILY_FREE_PRIZE_CREDITS,
  WELCOME_PRIZE_CREDITS,
} from '@/lib/arcadeEconomy';
import { ARCADE_TICKET_SCORE_RULES, TURBO_ARENA_WIN_BONUS_TICKETS } from '@/lib/ticketPayouts';
import { runit, runitFont, runitTextGlowCyan } from '@/lib/runitArcadeTheme';

function teaserLine(): string {
  if (ENABLE_BACKEND) {
    return `${PRIZE_RUN_ENTRY_CREDITS} cr. per prize run · scores → redeem tickets (Prizes tab). Tap for full breakdown.`;
  }
  return `${WELCOME_PRIZE_CREDITS} welcome · ${DAILY_FREE_PRIZE_CREDITS}/day free · ${PRIZE_RUN_ENTRY_CREDITS} cr./run. Tap for ticket rates per game.`;
}

/**
 * Full reference hidden behind “See more” so Arcade stays game-first.
 */
export function ArcadeRewardsGuide() {
  const [open, setOpen] = useState(false);

  return (
    <LinearGradient colors={['rgba(15,23,42,0.95)', 'rgba(30,27,75,0.92)']} style={[styles.outer, !open && styles.outerCollapsed]}>
      <View style={[styles.inner, !open && styles.innerCollapsed]}>
        <View style={styles.headerBlock}>
          <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowCyan]}>CREDITS & TICKETS</Text>
          {!open ? <Text style={styles.teaser}>{teaserLine()}</Text> : null}
        </View>

        {open ? (
          <>
            {ENABLE_BACKEND ? (
              <Text style={styles.sub}>
                Prize credits, welcome bonuses, and daily free credits are stored on your account when you&apos;re signed in.{' '}
                {PRIZE_RUN_ENTRY_CREDITS} credits per prize run · redeem tickets in the Prizes tab.
              </Text>
            ) : (
              <Text style={styles.sub}>
                {WELCOME_PRIZE_CREDITS} welcome credits on first install · {DAILY_FREE_PRIZE_CREDITS} free credits each day ·{' '}
                {PRIZE_RUN_ENTRY_CREDITS} credits per prize run ({TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS} for Turbo Arena)
              </Text>
            )}

            <Text style={styles.section}>Earn redeem tickets (prize runs)</Text>
            <Text style={styles.hint}>
              In a prize run, your score converts to redeem tickets for the shop. Same rates you already use in-game:
            </Text>

            <View style={styles.table}>
              <View style={styles.rowHead}>
                <Text style={[styles.cell, styles.cellGame, styles.headTxt]}>Game</Text>
                <Text style={[styles.cell, styles.cellMid, styles.headTxt]}>1 redeem ticket</Text>
              </View>
              {ARCADE_TICKET_SCORE_RULES.map((r) => (
                <View key={r.game} style={styles.row}>
                  <Text style={[styles.cell, styles.cellGame]}>{r.game}</Text>
                  <Text style={[styles.cell, styles.cellMid]}>
                    per {r.pointsPerTicket.toLocaleString()} {r.scoreLabel.toLowerCase()}
                  </Text>
                </View>
              ))}
              <View style={styles.row}>
                <Text style={[styles.cell, styles.cellGame]}>Turbo Arena</Text>
                <Text style={[styles.cell, styles.cellMid]}>
                  1 ticket per goal · +{TURBO_ARENA_WIN_BONUS_TICKETS} if you win · HARD AI · {TURBO_ARENA_PRIZE_RUN_ENTRY_CREDITS}{' '}
                  cr. entry
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <Pressable
          onPress={() => setOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Collapse credits and tickets details' : 'Expand credits and tickets details'}
          style={({ pressed }) => [styles.seeMoreRow, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.seeMoreText}>{open ? 'See less' : 'See more'}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={runit.neonCyan} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 16,
    padding: 2,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(157,78,237,0.35)',
  },
  outerCollapsed: {
    marginBottom: 12,
  },
  inner: {
    borderRadius: 14,
    backgroundColor: 'rgba(6,2,14,0.55)',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  innerCollapsed: {
    paddingVertical: 10,
  },
  headerBlock: {
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    letterSpacing: 1.6,
    color: '#fff',
    marginBottom: 6,
  },
  teaser: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 11,
    lineHeight: 16,
  },
  seeMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 6,
  },
  seeMoreText: {
    color: runit.neonCyan,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sub: {
    color: 'rgba(226,232,240,0.9)',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: 4,
  },
  section: {
    color: runit.neonPink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  hint: {
    color: 'rgba(148,163,184,0.9)',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  table: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  rowHead: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,240,255,0.08)',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.12)',
  },
  cell: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  cellGame: { flex: 1.1 },
  cellMid: { flex: 1.4 },
  headTxt: { color: 'rgba(148,163,184,0.95)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
