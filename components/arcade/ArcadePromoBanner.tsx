import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { arcade } from '@/lib/arcadeTheme';

export function ArcadePromoBanner() {
  return (
    <LinearGradient colors={['#EA580C', '#F97316', '#FBBF24']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.wrap}>
      <View style={styles.innerBorder}>
        <Text style={styles.kicker}>PRIZE CREDITS</Text>
        <Text style={styles.title}>Beat the AI, bank credits</Text>
        <Text style={styles.sub}>
          High scores earn prize credits to redeem in Prizes. Limited runs per day — watch ads for extra tries or buy tickets for more chances.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    padding: 3,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: arcade.goldBorder,
    shadowColor: arcade.cardShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  innerBorder: {
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  kicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },
  sub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '600',
  },
});
