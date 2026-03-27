import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function KCTextInput({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/50">{label}</Text>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.35)"
        className="rounded-xl border border-white/10 bg-ink-800 px-3 py-3 text-white"
        {...props}
      />
    </View>
  );
}
