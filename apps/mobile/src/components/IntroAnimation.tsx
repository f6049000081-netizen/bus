import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text, Dimensions } from 'react-native';
import { Colors, Fonts } from '../constants/theme';

const { width: SW } = Dimensions.get('window');
const CIRCLE = 82;
const RADIUS = CIRCLE / 2;
const FINAL_OFFSET = 20; // each circle centre's distance from screen centre when merged

export function IntroAnimation({ onDone }: { onDone: () => void }) {
  const leftX   = useRef(new Animated.Value(-(SW / 2 + RADIUS))).current;
  const rightX  = useRef(new Animated.Value(SW / 2 + RADIUS)).current;
  const eyeScale = useRef(new Animated.Value(0)).current;
  const pupilScale = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // ① Circles fly in from both sides  (700ms)
      Animated.parallel([
        Animated.timing(leftX, {
          toValue: -FINAL_OFFSET,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rightX, {
          toValue: FINAL_OFFSET,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // ② Eye-white appears  (180ms)
      Animated.timing(eyeScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      // ③ Pupil / iris drops in  (150ms)
      Animated.timing(pupilScale, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      // ④ Hold  (720ms — gives ~2 s total with fade)
      Animated.delay(720),
      // ⑤ Fade out  (250ms)
      Animated.timing(rootOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
      <View style={styles.logoRow}>
        {/* Left circle */}
        <Animated.View
          style={[styles.circle, styles.circleLeft, { transform: [{ translateX: leftX }] }]}
        />

        {/* Right circle */}
        <Animated.View
          style={[styles.circle, styles.circleRight, { transform: [{ translateX: rightX }] }]}
        />

        {/* Eye (sclera) — lens-shaped white oval that appears in the overlap */}
        <Animated.View
          pointerEvents="none"
          style={[styles.eyeSclera, { transform: [{ scale: eyeScale }] }]}
        />

        {/* Pupil + iris */}
        <Animated.View
          pointerEvents="none"
          style={[styles.pupilWrap, { transform: [{ scale: pupilScale }] }]}
        >
          <View style={styles.iris} />
          <View style={styles.pupil} />
          <View style={styles.highlight} />
        </Animated.View>
      </View>

      <Text style={styles.wordmark}>BUS</Text>
      <Text style={styles.tagline}>Between Us</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  logoRow: {
    width: CIRCLE * 2.2,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  circle: {
    position: 'absolute',
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: RADIUS,
    backgroundColor: Colors.primary,
    opacity: 0.92,
  },
  circleLeft:  { left: 0 },
  circleRight: { right: 0 },

  // White lens-shaped eye (approximated with a borderRadius oval)
  eyeSclera: {
    position: 'absolute',
    width: 42,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.white,
    zIndex: 2,
  },

  // Pupil + iris layered in the centre of the eye
  pupilWrap: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  iris: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  pupil: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.background,
  },
  highlight: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
    top: 3,
    right: 4,
  },

  wordmark: {
    fontSize: 36,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 6,
  },
});
