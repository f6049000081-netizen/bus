import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';
import { LogoMark } from '../../src/components/LogoMark';

export default function WelcomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <LogoMark variant="hero" />
        <Text style={styles.tagline}>Discover who you both already know.</Text>
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Your privacy, by design</Text>
        {[
          'Your contacts stay on your device — only encrypted fingerprints are shared.',
          'Raw phone numbers are never uploaded or stored on our servers.',
          "You see only names from your own address book — never from someone else's.",
          'Delete all your data any time with one tap.',
        ].map((item, i) => (
          <View key={i} style={styles.privacyItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.privacyText}>{item}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={() => router.push('/(auth)/phone')} activeOpacity={0.85}>
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xxl, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: Spacing.xxxl, gap: Spacing.md },
  tagline: { fontSize: FontSize.subheading, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
  privacyCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xl, marginBottom: Spacing.xxxl, borderWidth: 1, borderColor: Colors.border },
  privacyTitle: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.primaryLight, marginBottom: Spacing.md },
  privacyItem: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: { color: Colors.primary, fontSize: FontSize.body },
  privacyText: { flex: 1, fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22 },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
});
