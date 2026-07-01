import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getApiClient, ComparisonResult } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

export default function JoinCompareScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isAuthenticated } = useAuthStore();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace({ pathname: '/(auth)/welcome' } as never);
      return;
    }
    if (token) join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const { data } = await getApiClient().post<ComparisonResult>(`/api/comparison/join/${token}`);
      router.replace({ pathname: '/result/[id]', params: { id: data.id } } as never);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Join failed';
      setError(msg);
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      {joining ? (
        <>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.text}>Finding your mutual contacts…</Text>
          <Text style={styles.sub}>This only takes a moment. Your contacts stay on your device.</Text>
        </>
      ) : error ? (
        <>
          <Text style={styles.errorTitle}>Could not join</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(app)' as never)} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  text: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginTop: Spacing.xl, textAlign: 'center' },
  sub: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center', lineHeight: 22 },
  errorTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.bold, color: Colors.danger, marginBottom: Spacing.sm },
  errorText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xxxl },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, paddingHorizontal: Spacing.xxl },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
});
