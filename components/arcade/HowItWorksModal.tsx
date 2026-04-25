import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { runit, runitFont, runitTextGlowCyan, runitTextGlowPink } from '@/lib/runitArcadeTheme';

type StepDef = {
  title: string;
  body: string;
  icon: ComponentProps<typeof SafeIonicons>['name'];
  frameColors: readonly [string, string];
  iconTint: string;
};

const STEPS: StepDef[] = [
  {
    title: 'Choose your game',
    body: 'Each queue is a live skill contest on a minigame — the same titles you play in Arcade, but here you face another player in real time.',
    icon: 'game-controller-outline',
    frameColors: ['rgba(124,58,237,0.55)', 'rgba(30,27,75,0.95)'],
    iconTint: '#a5b4fc',
  },
  {
    title: 'Pick a contest tier',
    body: 'Your entry pays for match access at that tier. The prize shown goes to the top performer. Use your wallet when a paid tier needs funds.',
    icon: 'wallet-outline',
    frameColors: ['rgba(236,72,153,0.45)', 'rgba(76,29,149,0.9)'],
    iconTint: '#f9a8d4',
  },
  {
    title: 'We match you',
    body: 'We pair you with someone on the same game and tier. Quick Match helps you jump in faster when lots of players are searching.',
    icon: 'people-outline',
    frameColors: ['rgba(255,215,0,0.35)', 'rgba(59,7,100,0.92)'],
    iconTint: '#7dd3fc',
  },
  {
    title: 'Play & compare scores',
    body: 'You both play the same run. Highest score wins the tier prize; either way you still earn Arcade Credits to keep playing on the Arcade floor.',
    icon: 'trophy-outline',
    frameColors: ['rgba(251,191,36,0.35)', 'rgba(120,53,15,0.88)'],
    iconTint: '#fde68a',
  },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

function StepIllustration({ step }: { step: StepDef }) {
  return (
    <View style={styles.illusOuter} accessibilityRole="image" accessibilityLabel={step.title}>
      <LinearGradient colors={[...step.frameColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.illusFrame}>
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.15)']}
          style={styles.illusInner}
        >
          <SafeIonicons name={step.icon} size={44} color={step.iconTint} />
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

export function HowItWorksModal({ visible, onClose }: Props) {
  const { width } = useWindowDimensions();
  const maxSheet = Math.min(400, width - 28);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  const last = stepIndex >= STEPS.length - 1;
  const step = STEPS[stepIndex]!;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { maxWidth: maxSheet }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: runitFont.black }, runitTextGlowPink]}>How it works</Text>
              <Text style={[styles.stepKicker, runitTextGlowCyan]}>
                Step {stepIndex + 1} of {STEPS.length}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
            >
              <SafeIonicons name="close" size={22} color="rgba(226,232,240,0.9)" />
            </Pressable>
          </View>

          <StepIllustration step={step} />

          <Text style={styles.stepTitle}>{step.title}</Text>
          <Text style={styles.stepBody}>{step.body}</Text>

          <View style={styles.footer}>
            <View style={styles.dotsRow}>
              {STEPS.map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setStepIndex(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to step ${i + 1}`}
                  hitSlop={8}
                  style={styles.dotHit}
                >
                  {i === stepIndex ? (
                    <View style={styles.dotActive} />
                  ) : (
                    <View style={styles.dotIdle} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.navBtns}>
              <Pressable
                onPress={() => setStepIndex((s) => Math.max(0, s - 1))}
                disabled={stepIndex === 0}
                style={({ pressed }) => [
                  styles.prevBtn,
                  stepIndex === 0 && styles.prevDisabled,
                  pressed && stepIndex > 0 && { opacity: 0.75 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Previous step"
              >
                <SafeIonicons
                  name="chevron-back"
                  size={18}
                  color={stepIndex === 0 ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.95)'}
                />
                <Text style={[styles.prevTxt, stepIndex === 0 && styles.prevTxtDisabled]}>Previous</Text>
              </Pressable>

              {last ? (
                <Pressable onPress={onClose} style={({ pressed }) => [styles.nextOuter, pressed && { opacity: 0.92 }]}>
                  <LinearGradient
                    colors={['#FFD700', '#D97706', '#B45309']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextGrad}
                  >
                    <Text style={[styles.nextTxt, { fontFamily: runitFont.bold }]}>Done</Text>
                    <SafeIonicons name="checkmark-circle" size={18} color="#042f2e" />
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setStepIndex((s) => Math.min(STEPS.length - 1, s + 1))}
                  style={({ pressed }) => [styles.nextOuter, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Next step"
                >
                  <LinearGradient
                    colors={['#FFD700', '#D97706', '#B45309']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.nextGrad}
                  >
                    <Text style={[styles.nextTxt, { fontFamily: runitFont.bold }]}>Next</Text>
                    <SafeIonicons name="chevron-forward" size={18} color="#042f2e" />
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,15,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  sheet: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(10,12,24,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(236,72,153,0.35)',
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    letterSpacing: 0.4,
    color: '#fff',
  },
  stepKicker: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
  },
  illusOuter: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 200,
    marginBottom: 14,
  },
  illusFrame: {
    borderRadius: 16,
    padding: 2,
  },
  illusInner: {
    borderRadius: 14,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  stepTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  stepBody: {
    color: 'rgba(203,213,225,0.94)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    minHeight: 84,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotHit: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dotActive: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: runit.neonCyan,
  },
  dotIdle: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.4)',
  },
  navBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  prevDisabled: {
    opacity: 0.55,
  },
  prevTxt: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 13,
    fontWeight: '700',
  },
  prevTxtDisabled: {
    color: 'rgba(148,163,184,0.4)',
  },
  nextOuter: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 108,
  },
  nextGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  nextTxt: {
    color: '#042f2e',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
