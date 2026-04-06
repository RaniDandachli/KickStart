import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';
import { isUuid } from '@/lib/isUuid';
import { fileH2hMatchDisputeRpc } from '@/services/api/h2hTapDash';
import { useAuthStore } from '@/store/authStore';

export default function DisputeScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? 'guest');
  const [matchId, setMatchId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const mid = matchId.trim();
    if (!isUuid(mid)) {
      Alert.alert('Invalid match id', 'Paste the match session UUID from your match or result screen.');
      return;
    }
    const t = notes.trim();
    if (t.length < 12) {
      Alert.alert('Add detail', 'Please describe what happened in at least 12 characters.');
      return;
    }
    if (userId === 'guest') {
      Alert.alert('Sign in required', 'Log in to file a dispute.');
      return;
    }
    setBusy(true);
    try {
      const r = await fileH2hMatchDisputeRpc(mid, t);
      if (!r.ok) {
        const msg =
          r.error === 'forbidden'
            ? 'You can only dispute matches you played in.'
            : r.error === 'not_found'
              ? 'That match was not found.'
              : r.error === 'details_too_short'
                ? 'Please add more detail (at least 12 characters).'
                : 'Could not submit your dispute. Try again.';
        Alert.alert('Dispute not submitted', msg);
        return;
      }
      Alert.alert(
        'Dispute received',
        'Support will review your report. You can add screenshots or other evidence when we follow up.',
      );
      setMatchId('');
      setNotes('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Match dispute</Text>
      <Card className="mb-4">
        <Text className="text-sm text-slate-600">
          File a dispute for a head-to-head match you participated in. Include what went wrong and any relevant context.
          Evidence attachments may be requested in follow-up.
        </Text>
      </Card>
      <KCTextInput label="Match session id" value={matchId} onChangeText={setMatchId} autoCapitalize="none" />
      <KCTextInput
        label="What happened?"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />
      {busy ? (
        <View className="my-4 items-center">
          <ActivityIndicator color="#34D399" />
        </View>
      ) : null}
      <AppButton title="Submit dispute" variant="secondary" disabled={busy} onPress={() => void submit()} />
    </Screen>
  );
}
