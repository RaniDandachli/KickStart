import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { arcade } from '@/lib/arcadeTheme';

interface Props {
  balanceLabel?: string;
  onAddPress?: () => void;
}

export function ArcadeBalanceBar({ balanceLabel = '1,240 credits', onAddPress }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.balance}>
        <Text style={styles.diamond}>◆ </Text>
        {balanceLabel}
      </Text>
      <Pressable onPress={onAddPress} accessibilityRole="button">
        <LinearGradient colors={[arcade.limeDark, '#84CC16']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
          <Text style={styles.addText}>+ ADD</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6,13,24,0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  balance: {
    color: arcade.lime,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  diamond: { color: arcade.gold },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  addText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
});
