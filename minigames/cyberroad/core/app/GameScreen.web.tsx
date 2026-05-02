import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CYBER_ROAD_GAME_TITLE } from '../branding';
import { CyberRoadUi } from '../uiTheme';

/**
 * Web / static export: `expo-gl` GLView uses native views and breaks SSR (`requireNativeViewManager`).
 * Native gameplay stays in {@link GameScreen.native}.
 */
export default function GameScreen(_props: {
  h2hSkillContest?: boolean;
  h2hSuppressGameOver?: boolean;
  onH2hRunComplete?: (stats: { score: number; durationMs: number; taps: number }) => void;
}) {
  return (
    <View style={styles.fill} accessibilityRole="summary">
      <Text style={styles.title}>{CYBER_ROAD_GAME_TITLE}</Text>
      <Text style={styles.body}>
        This lane runner uses OpenGL on device. The web build here is for browsing the Arcade shell — open{' '}
        <Text style={styles.em}>Cyber Road</Text> in the Expo Go or production app on iOS or Android to play.
      </Text>
      {_props.h2hSkillContest ? (
        <Text style={styles.h2h}>Head-to-head runs require the native game client so scores validate correctly.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    backgroundColor: CyberRoadUi.bgRoot,
    minHeight: 200,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: CyberRoadUi.accentCyan,
    marginBottom: 14,
    letterSpacing: 1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: CyberRoadUi.textMuted,
  },
  em: {
    color: CyberRoadUi.textPrimary,
    fontWeight: '700',
  },
  h2h: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: CyberRoadUi.accentMagenta,
    fontWeight: '600',
  },
});
