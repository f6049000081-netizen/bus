import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getApiClient, AuthResponse } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';
import { LogoMark } from '../../src/components/LogoMark';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setSession } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) { Toast.show({ type: 'error', text1: 'Enter the 6-digit code' }); return; }
    setLoading(true);
    try {
      const { data } = await getApiClient().post<AuthResponse>('/api/auth/verify-otp', { phone, code });
      await setSession(data);
      router.replace('/(app)');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Verification failed';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}><LogoMark variant="inline" /></View>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>Sent to {phone}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="000000"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading || code.length !== 6} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backText}>← Change number</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl, justifyContent: 'center' },
  logoRow: { marginBottom: Spacing.xxxl },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
  input: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary, borderRadius: Radii.md, padding: Spacing.lg, fontSize: 32, color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 16 },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  backLink: { alignItems: 'center' },
  backText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
