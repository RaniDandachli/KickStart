import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { registerWhopCheckoutUI } from '@/lib/whopCheckoutBridge';
import type { WhopCheckoutPayload } from '@/lib/whopCheckoutTypes';
import { runit } from '@/lib/runitArcadeTheme';

function terminalCheckoutResult(url: string): 'success' | 'cancel' | null {
  if (url.includes('status=success')) return 'success';
  if (url.includes('status=cancel')) return 'cancel';
  return null;
}

/**
 * iOS / Android: modal + WebView to Whop checkout (in-app; no separate browser app).
 */
export function WhopCheckoutHost() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<WhopCheckoutPayload | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback((ok: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setOpen(false);
    setPayload(null);
    resolverRef.current?.(ok);
    resolverRef.current = null;
  }, []);

  useEffect(() => {
    registerWhopCheckoutUI((p: WhopCheckoutPayload) => {
      return new Promise<boolean>((resolve) => {
        doneRef.current = false;
        resolverRef.current = resolve;
        setPayload(p);
        setOpen(true);
      });
    });
    return () => registerWhopCheckoutUI(null);
  }, []);

  return (
    <Modal visible={open && !!payload} animationType="slide" onRequestClose={() => finish(false)}>
      {payload ? (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Pay with Whop</Text>
            <Pressable onPress={() => finish(false)} style={styles.closeBtn} accessibilityRole="button">
              <Text style={styles.closeTxt}>Close</Text>
            </Pressable>
          </View>
          <WebView
            source={{ uri: payload.url }}
            style={styles.webview}
            onShouldStartLoadWithRequest={(req) => {
              const t = terminalCheckoutResult(req.url);
              if (t === 'success') {
                finish(true);
                return false;
              }
              if (t === 'cancel') {
                finish(false);
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(nav) => {
              const t = terminalCheckoutResult(nav.url);
              if (t === 'success') finish(true);
              if (t === 'cancel') finish(false);
            }}
          />
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06020e' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 16 },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  closeTxt: { color: runit.neonCyan, fontWeight: '800', fontSize: 15 },
  webview: { flex: 1 },
});
