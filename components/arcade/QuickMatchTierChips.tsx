import { Pressable, StyleSheet, Text, View } from 'react-native';

import { labelForQuickMatchEntryCents, QUICK_MATCH_KNOWN_ENTRY_CENTS } from '@/lib/quickMatchTiers';

type Props = {
  maxAffordableEntryCents: number;
  selected: readonly number[];
  onChange: (next: number[]) => void;
};

/**
 * Multi-select tiers for Quick Match (free + $1 … $100 entry levels server supports).
 */
export function QuickMatchTierChips({ maxAffordableEntryCents, selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(entryCents: number) {
    const next = new Set(selected);
    if (next.has(entryCents)) next.delete(entryCents);
    else next.add(entryCents);
    onChange(Array.from(next).sort((a, b) => a - b));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>Contest tiers you’re OK with</Text>
      <Text style={styles.hint}>We only pair you on a tier you select. Free = no wallet charge.</Text>
      <View style={styles.row}>
        {QUICK_MATCH_KNOWN_ENTRY_CENTS.map((cents) => {
          const disabled = cents > maxAffordableEntryCents;
          const on = set.has(cents);
          return (
            <Pressable
              key={cents}
              disabled={disabled}
              onPress={() => toggle(cents)}
              style={({ pressed }) => [
                styles.chip,
                on && styles.chipOn,
                disabled && styles.chipDisabled,
                pressed && !disabled && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn, disabled && styles.chipTxtDis]}>
                {labelForQuickMatchEntryCents(cents)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  kicker: {
    color: 'rgba(203,213,225,0.95)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  hint: { color: 'rgba(148,163,184,0.9)', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.45)',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  chipOn: {
    borderColor: 'rgba(167,139,250,0.85)',
    backgroundColor: 'rgba(139,92,246,0.22)',
  },
  chipDisabled: { opacity: 0.38 },
  chipTxt: { color: 'rgba(226,232,240,0.95)', fontSize: 12, fontWeight: '700' },
  chipTxtOn: { color: '#e9d5ff' },
  chipTxtDis: { color: 'rgba(148,163,184,0.7)' },
});
