import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors } from '../../src/constants/theme';

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;

  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border },
      tabBarActiveTintColor: Colors.primary,
      tabBarInactiveTintColor: Colors.textSecondary,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="dial" options={{ title: 'Dial', tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="compare" options={{ title: 'Compare', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="privacy" options={{ title: 'Privacy', tabBarIcon: ({ color, size }) => <Ionicons name="shield-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
