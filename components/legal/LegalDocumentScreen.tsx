import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { SafeIonicons } from '@/components/icons/SafeIonicons';
import { Screen } from '@/components/ui/Screen';
import type { LegalSection } from '@/lib/inAppLegalCopy';
import { runit } from '@/lib/runitArcadeTheme';
import { useAuthStore } from '@/store/authStore';

export function LegalDocumentScreen({
  heading,
  lastUpdated,
  sections,
}: {
  heading: string;
  lastUpdated: string;
  sections: LegalSection[];
}) {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (authStatus === 'signedIn') {
      router.replace('/(app)/(tabs)/profile/legal');
      return;
    }
    router.replace('/(auth)/sign-up');
  }

  return (
    <Screen>
      <View className="mb-4 flex-row items-center gap-3">
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={goBack}
          className="flex-row items-center gap-1 rounded-xl border border-slate-500/50 bg-slate-900/60 py-2 pl-1 pr-3 active:opacity-90"
        >
          <SafeIonicons name="chevron-back" size={26} color={runit.neonCyan} />
          <Text className="text-base font-extrabold text-slate-100">Back</Text>
        </Pressable>
        <Text className="min-w-0 flex-1 text-xl font-bold text-white" numberOfLines={2}>
          {heading}
        </Text>
      </View>
      <Text className="mb-6 text-xs text-slate-500">Last updated: {lastUpdated}</Text>
      {sections.map((s, i) => (
        <View key={`${s.title}-${i}`} className="mb-6">
          <Text className="mb-2 text-base font-bold text-white">{s.title}</Text>
          {s.paragraphs.map((p, j) => (
            <Text key={j} className="mb-3 text-sm leading-6 text-slate-300">
              {p}
            </Text>
          ))}
        </View>
      ))}
      <Text className="mb-8 mt-1 text-xs italic leading-5 text-slate-500">
        This information is not legal advice. Have qualified counsel review these documents for your business and jurisdictions.
      </Text>
    </Screen>
  );
}
