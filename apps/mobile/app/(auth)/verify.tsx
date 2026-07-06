import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getApiClient, AuthResponse } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';
import { LogoMark } from '../../src/components/LogoMark';

type Step = 'otp' | 'name';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setSession, updateUser } = useAuthStore();

  const [step, setStep] = useState<Step>('otp');
  const [code, setCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) { Toast.show({ type: 'error', text1: 'Enter the 6-digit code' }); return; }
    setLoading(true);
    try {
      const { data } = await getApiClient().post<AuthResponse>('/api/auth/verify-otp', { phone, code });
      await setSession(data);
      // New user has no display name yet — collect it before entering the app
      if (!data.user.displayName) {
        setStep('name');
      } else {
        router.replace('/(app)');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Verification failed';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    const full = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim()) { Toast.show({ type: 'error', text1: 'Enter your first name' }); return; }
    setLoading(true);
    try {
      await getApiClient().patch('/api/user/me', { displayName: full });
      updateUser({ displayName: full });
      router.replace('/(app)');
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to save name', text2: 'Try again' });
    } finally {
      setLoading(false);
    }
  };

  if (step === 'name') {
    return (
      <View style={styles.container}>
        <View style={styles.logoRow}><LogoMark variant="inline" /></View>
        <Text style={styles.title}>What's your name?</Text>
        <Text style={styles.subtitle}>This is how other BUS users will find and recognise you.</Text>
        <TextInput
          style={styles.nameInput}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={Colors.textSecondary}
          autoFocus
          autoCapitalize="words"
          maxLength={30}
          returnKeyType="next"
        />
        <TextInput
          style={styles.nameInput}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={handleSaveName}
        />
        <TouchableOpacity
          style={[styles.button, !firstName.trim() && styles.buttonDisabled]}
          onPress={handleSaveName}
          disabled={loading || !firstName.trim()}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Continue</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}><LogoMark variant="inline" /></View>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>Sent to {phone}</Text>
      <TextInput
        style={styles.otpInput}
        value={code}
        onChangeText={setCode}
        placeholder="000000"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
        autoFocus
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleVerify}
        disabled={loading || code.length !== 6}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backText}>← Change number</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl, justifyContent: 'flex-start', paddingTop: 72 },
  logoRow: { marginBottom: Spacing.xxxl },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.xl, lineHeight: 22 },
  otpInput: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radii.md, padding: Spacing.lg, fontSize: 32,
    color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 16,
  },
  nameInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md + 2,
    fontSize: FontSize.body, color: Colors.textPrimary, marginBottom: Spacing.md,
  },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  backLink: { alignItems: 'center' },
  backText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
