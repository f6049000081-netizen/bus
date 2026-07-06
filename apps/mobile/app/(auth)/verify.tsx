import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef  = useRef<TextInput>(null);

  const canSubmit = code.length === 6 && firstName.trim().length > 0;

  const handleVerify = async () => {
    if (!canSubmit) {
      if (code.length !== 6) Toast.show({ type: 'error', text1: 'Enter the 6-digit code' });
      else Toast.show({ type: 'error', text1: 'Enter your first name' });
      return;
    }
    setLoading(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const { data } = await getApiClient().post<AuthResponse>('/api/auth/verify-otp', {
        phone,
        code,
        displayName,
      });
      await setSession(data);
      router.replace('/(app)');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Verification failed';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.logoRow}><LogoMark variant="inline" /></View>

      <Text style={styles.title}>Verify your number</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {phone}</Text>

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
        returnKeyType="next"
        onSubmitEditing={() => firstNameRef.current?.focus()}
      />

      <Text style={styles.sectionLabel}>Your name</Text>
      <Text style={styles.sectionHint}>Required for new accounts — returning users can leave this blank.</Text>

      <View style={styles.nameRow}>
        <TextInput
          ref={firstNameRef}
          style={[styles.nameInput, { flex: 1 }]}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          maxLength={30}
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />
        <TextInput
          ref={lastNameRef}
          style={[styles.nameInput, { flex: 1 }]}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="words"
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backText}>← Change number</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1, backgroundColor: Colors.background,
    padding: Spacing.xxl, paddingTop: 72,
  },
  logoRow: { marginBottom: Spacing.xxxl },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.xl },
  otpInput: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.primary,
    borderRadius: Radii.md, padding: Spacing.lg, fontSize: 32,
    color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 16,
  },
  sectionLabel: {
    fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.xs,
  },
  sectionHint: {
    fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary,
    marginBottom: Spacing.md, lineHeight: 18,
  },
  nameRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  nameInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md + 2,
    fontSize: FontSize.body, color: Colors.textPrimary,
  },
  button: {
    backgroundColor: Colors.primary, borderRadius: Radii.button,
    padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  backLink: { alignItems: 'center' },
  backText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
