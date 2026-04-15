import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import type { LegalSection } from '@/lib/inAppLegalCopy';
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
      <View className="mb-4 flex-row items-center gap-2">
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={12} onPress={goBack}>
          <Ionicons name="chevron-back" size={28} color="#e2e8f0" />
        </Pressable>
        <Text className="flex-1 text-xl font-bold text-white" numberOfLines={2}>
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
