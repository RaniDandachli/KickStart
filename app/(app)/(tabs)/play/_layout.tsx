import { Stack } from 'expo-router';

export default function PlayStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#06080f' },
        headerTintColor: '#f4f6ff',
        contentStyle: { backgroundColor: '#06080f' },
      }}
    />
  );
}
