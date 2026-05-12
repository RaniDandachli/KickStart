import { WhopCheckoutEmbed } from '@whop/checkout/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { registerWhopCheckoutUI } from '@/lib/whopCheckoutBridge';
import type { WhopCheckoutPayload } from '@/lib/whopCheckoutTypes';
import { runit } from '@/lib/runitArcadeTheme';

/**
 * Web: embedded Whop checkout (iframe) in a modal — in-page flow instead of leaving the tab.
 */
export function WhopCheckoutHost() {
  const { height: winH } = useWindowDimensions();
  /** Fixed height so the embed + iframe get a definite flex box; avoids clipping Whop footer (Join) when the form grows. */
  const sheetHeight = useMemo(() => Math.min(Math.round(winH * 0.92), Math.max(440, winH - 16)), [winH]);

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
    <Modal visible={open && !!payload} animationType="slide" transparent onRequestClose={() => finish(false)}>
      {payload ? (
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { height: sheetHeight }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Pay with Whop</Text>
              <Pressable onPress={() => finish(false)} style={styles.closeBtn} accessibilityRole="button">
                <Text style={styles.closeTxt}>Close</Text>
              </Pressable>
            </View>
            <View className="whop-checkout-embed-host" style={styles.embedWrap}>
              {payload.sessionId ? (
                <WhopCheckoutEmbed
                  sessionId={payload.sessionId}
                  returnUrl={payload.returnUrl}
                  theme="dark"
                  themeOptions={{ accentColor: 'violet' }}
                  onComplete={() => finish(true)}
                />
              ) : (
                // Hosted Whop URL when API omits embed id (or embed blocked — e.g. strict Safari).
                // eslint-disable-next-line react/forbid-elements -- RN Web: real iframe for Whop hosted page
                <iframe
                  title="Whop checkout"
                  src={payload.url}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 0,
                    flex: 1,
                    border: 'none',
                  }}
                />
              )}
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#0b0b12',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    flexDirection: 'column',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  sheetTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  closeBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  closeTxt: { color: runit.neonCyan, fontWeight: '800', fontSize: 15 },
  embedWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
  },
});
