import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { runitFont } from '@/lib/runitArcadeTheme';
import { useMinigameExitNav } from '@/minigames/ui/useMinigameExitNav';
import { useHidePlayTabBar } from '@/minigames/ui/useHidePlayTabBar';

const CYBER_ROAD_URL = 'https://crossyroad.expo.app/';

export default function CyberRoadScreen() {
  useHidePlayTabBar();
  const { onHeaderBackPress, replacePrimaryLabel } = useMinigameExitNav();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'web') return;
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
      return () => {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      };
    }, []),
  );

  return (
    <View style={styles.wrap}>
      <SafeAreaView style={styles.safeTop} edges={['top']} accessibilityRole="header">
        <Pressable
          onPress={onHeaderBackPress}
          accessibilityRole="button"
          accessibilityLabel={`Back · ${replacePrimaryLabel}`}
          hitSlop={12}
          style={({ pressed }) => [styles.backRow, pressed && { opacity: 0.88 }]}
        >
          <SafeIonicons name="chevron-back" size={24} color="#22d3ee" />
          <Text style={styles.backTxt}>{replacePrimaryLabel}</Text>
        </Pressable>
      </SafeAreaView>
      <WebView
        style={styles.web}
        source={{ uri: CYBER_ROAD_URL }}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo={false}
        nestedScrollEnabled
        mediaPlaybackRequiresUserAction
        {...(Platform.OS === 'android' ? { mixedContentMode: 'always' as const } : {})}
        {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true as const } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#060610',
  },
  safeTop: {
    backgroundColor: 'rgba(6, 6, 16, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.25)',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
  },
  backTxt: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontFamily: runitFont.black,
  },
  web: {
    flex: 1,
    backgroundColor: '#060610',
  },
});
