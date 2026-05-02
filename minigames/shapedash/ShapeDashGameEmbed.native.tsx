import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = { html: string };

/**
 * iOS / Android: WebView with bundled HTML.
 */
export function ShapeDashGameEmbed({ html }: Props) {
  const injected = useMemo(
    () => `
      (function() {
        document.documentElement.style.background = '#060610';
        document.body.style.background = '#060610';
      })();
      true;
    `,
    [],
  );

  return (
    <View style={styles.embedWrap} accessibilityLabel="Shape Dash">
      <WebView
        style={styles.web}
        originWhitelist={['*']}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScriptBeforeContentLoaded={injected}
        nestedScrollEnabled
        allowsFullscreenVideo={false}
        mediaPlaybackRequiresUserAction
        {...(Platform.OS === 'android' ? { mixedContentMode: 'always' as const } : {})}
        {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true as const } : {})}
        setBuiltInZoomControls={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  embedWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#060610',
  },
  web: {
    flex: 1,
    backgroundColor: '#060610',
  },
});
