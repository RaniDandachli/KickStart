import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function KCTextInput({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-200/90">{label}</Text>
      <TextInput
        placeholderTextColor="rgba(100,116,139,0.85)"
        className="rounded-xl border-2 border-amber-400/35 bg-white/95 px-3 py-3 text-slate-900"
        {...props}
      />
    </View>
  );
}
