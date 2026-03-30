import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDefaultTabBarStyle } from '@/lib/tabBarStyle';

const ICON = 20;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: getDefaultTabBarStyle(insets.bottom),
        tabBarActiveTintColor: '#ff006e',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 10,
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarItemStyle: {
          paddingVertical: 4,
          justifyContent: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <Ionicons name="trophy" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Arcade',
          tabBarIcon: ({ color }) => <Ionicons name="game-controller" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="prizes"
        options={{
          title: 'Prizes',
          tabBarIcon: ({ color }) => <Ionicons name="gift" color={color} size={ICON} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color }) => <Ionicons name="person" color={color} size={ICON} />,
        }}
      />
    </Tabs>
  );
}
