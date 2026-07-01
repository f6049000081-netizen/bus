import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

interface Props {
  variant?: 'hero' | 'inline';
}

export function LogoMark({ variant = 'hero' }: Props) {
  if (variant === 'inline') {
    return (
      <View style={styles.inline}>
        <Image source={require('../../assets/icon.png')} style={styles.iconSm} />
        <Text style={styles.wordmarkSm}>BUS</Text>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <Image source={require('../../assets/icon.png')} style={styles.iconLg} />
      <Text style={styles.wordmarkLg}>BUS</Text>
      <Text style={styles.tagline}>Between Us</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12 },
  iconLg: { width: 96, height: 96, borderRadius: 22 },
  wordmarkLg: {
    fontSize: 38, fontFamily: Fonts.bold,
    color: Colors.textPrimary, letterSpacing: 3,
  },
  tagline: {
    fontSize: 14, fontFamily: Fonts.regular,
    color: Colors.textSecondary, letterSpacing: 1,
  },

  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconSm: { width: 28, height: 28, borderRadius: 6 },
  wordmarkSm: {
    fontSize: 18, fontFamily: Fonts.bold,
    color: Colors.textPrimary, letterSpacing: 2,
  },
});
