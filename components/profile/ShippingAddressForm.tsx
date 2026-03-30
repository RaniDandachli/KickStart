import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { ShippingAddress } from '@/lib/shippingAddress';

type Props = {
  value: ShippingAddress;
  onChange: (next: ShippingAddress) => void;
};

function field<K extends keyof ShippingAddress>(key: K, label: string, hint?: string, multiline?: boolean) {
  return { key, label, hint, multiline } as const;
}

const FIELDS = [
  field('fullName', 'Full name'),
  field('line1', 'Address line 1', 'Street address, P.O. box'),
  field('line2', 'Address line 2', 'Apartment, suite, unit (optional)', true),
  field('city', 'City'),
  field('region', 'State / province / region'),
  field('postalCode', 'Postal / ZIP code'),
  field('country', 'Country'),
];

export function ShippingAddressForm({ value, onChange }: Props) {
  const set = (key: keyof ShippingAddress, text: string) => {
    onChange({ ...value, [key]: text });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>
        Used only to ship physical prizes. You can update this anytime in Settings.
      </Text>
      {FIELDS.map(({ key, label, hint, multiline }) => (
        <View key={key} style={styles.row}>
          <Text style={styles.lbl}>{label}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <TextInput
            value={value[key]}
            onChangeText={(t) => set(key, t)}
            placeholderTextColor="rgba(148,163,184,0.8)"
            placeholder={label}
            style={[styles.input, multiline && styles.inputMulti]}
            multiline={!!multiline}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  intro: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  row: { gap: 4 },
  lbl: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  hint: { color: 'rgba(148,163,184,0.85)', fontSize: 11 },
  input: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(51,65,85,0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 15,
  },
  inputMulti: { minHeight: 56, textAlignVertical: 'top' },
});
