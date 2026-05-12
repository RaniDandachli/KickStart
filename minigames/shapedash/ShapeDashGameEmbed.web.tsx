import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = { html: string };

/**
 * Web: DOM iframe + srcDoc (react-native-webview is not loaded on this platform).
 */
export function ShapeDashGameEmbed({ html }: Props) {
  return (
    <View style={styles.embedWrap} accessibilityLabel="Shape Dash">
      {createElement('iframe', {
        srcDoc: html,
        title: 'Shape Dash',
        style: ({
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          backgroundColor: '#060610',
          flexGrow: 1,
        }) as Record<string, unknown>,
        allow: 'fullscreen',
        tabIndex: 0,
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  embedWrap: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#060610',
  },
});
