import { Text } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';

/** Placeholder — wire to `supabase.auth.resetPasswordForEmail` + deep link handler. */
export default function ForgotPasswordScreen() {
  return (
    <Screen>
      <Card>
        <Text className="text-base font-semibold text-slate-900">Password reset</Text>
        <Text className="mt-2 text-sm text-slate-600">
          TODO: Configure Supabase redirect URLs and call `resetPasswordForEmail` from a submit form.
        </Text>
      </Card>
    </Screen>
  );
}
