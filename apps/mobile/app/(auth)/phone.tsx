import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const normalized = phone.trim();
    if (!normalized.startsWith('+')) {
      Toast.show({ type: 'error', text1: 'Use international format', text2: 'e.g. +2519xxxxxxxx' });
      return;
    }
    setLoading(true);
    try {
      await getApiClient().post('/api/auth/request-otp', { phone: normalized });
      router.push({ pathname: '/(auth)/verify', params: { phone: normalized } });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send OTP';
      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your number</Text>
      <Text style={styles.subtitle}>{"We'll send a verification code via SMS."}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+2519xxxxxxxx"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="phone-pad"
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleSend} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Send Code</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl, justifyContent: 'center' },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.md, padding: Spacing.lg, fontSize: FontSize.subheading, color: Colors.textPrimary, marginBottom: Spacing.xl, letterSpacing: 2 },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
});
