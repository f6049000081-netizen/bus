import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { configureApiClient } from '@bus/shared';
import { useAuthStore } from '../src/stores/authStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const { initialize, isLoading, refreshToken, logout } = useAuthStore();

  useEffect(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
    configureApiClient({
      baseURL: apiUrl,
      getAccessToken: () => useAuthStore.getState().accessToken,
      refreshToken,
      logout,
    });
    initialize();
  }, []);

  if (isLoading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </QueryClientProvider>
  );
}
