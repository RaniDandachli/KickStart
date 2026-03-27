import { useState } from 'react';
import { Alert, Text } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { Card } from '@/components/ui/Card';
import { KCTextInput } from '@/components/ui/KCTextInput';
import { Screen } from '@/components/ui/Screen';

export default function DisputeScreen() {
  const [matchId, setMatchId] = useState('');
  const [notes, setNotes] = useState('');

  function submit() {
    Alert.alert(
      'Dispute queued',
      'TODO: POST to `reports` + set `match_sessions.dispute_status`. Requires signed-in context.',
    );
  }

  return (
    <Screen>
      <Text className="mb-4 text-2xl font-bold text-white">Match dispute</Text>
      <Card className="mb-4">
        <Text className="text-sm text-white/70">
          Evidence fields (replays, screenshots) attach later via storage signed URLs.
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
      <AppButton title="Submit (stub)" variant="secondary" onPress={submit} />
    </Screen>
  );
}
