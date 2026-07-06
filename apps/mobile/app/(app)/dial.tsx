import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { makeCall, isDefaultDialer, requestDialerRole, type DialerRole } from '../../src/services/dialerService';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

const KEYS: Array<{ digit: string; sub?: string }> = [
  { digit: '1', sub: '' },
  { digit: '2', sub: 'ABC' },
  { digit: '3', sub: 'DEF' },
  { digit: '4', sub: 'GHI' },
  { digit: '5', sub: 'JKL' },
  { digit: '6', sub: 'MNO' },
  { digit: '7', sub: 'PQRS' },
  { digit: '8', sub: 'TUV' },
  { digit: '9', sub: 'WXYZ' },
  { digit: '*' },
  { digit: '0', sub: '+' },
  { digit: '#' },
];

export default function DialScreen() {
  const [number, setNumber] = useState('');
  const [calling, setCalling] = useState(false);
  const [defaultDialer, setDefaultDialer] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    isDefaultDialer().then(setDefaultDialer).catch(() => {});
  }, []);

  const press = (digit: string) => {
    setNumber((n) => (n.length < 20 ? n + digit : n));
  };

  const backspace = () => setNumber((n) => n.slice(0, -1));

  const call = async () => {
    if (!number) return;
    setCalling(true);
    try {
      const result = await makeCall(number);
      if (result === 'dialer') {
        Toast.show({ type: 'info', text1: 'Opening dialer', text2: number });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Call failed', text2: 'Could not place the call.' });
    } finally {
      setCalling(false);
    }
  };

  const handleSetAsDefault = async () => {
    setRoleLoading(true);
    try {
      const result: DialerRole = await requestDialerRole();
      if (result === 'GRANTED') {
        setDefaultDialer(true);
        Toast.show({ type: 'success', text1: 'BUS is now your default dialer', text2: 'Incoming calls will show BUS caller info.' });
      } else if (result === 'DENIED') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'You can change this in Settings → Default apps.' });
      } else {
        Toast.show({ type: 'info', text1: 'Not supported', text2: 'Requires Android 10 or later.' });
      }
    } finally {
      setRoleLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Default dialer banner */}
      {!defaultDialer && (
        <TouchableOpacity style={styles.banner} onPress={handleSetAsDefault} disabled={roleLoading} activeOpacity={0.8}>
          {roleLoading
            ? <ActivityIndicator color={Colors.primary} size="small" />
            : <>
                <Text style={styles.bannerTitle}>Set BUS as default dialer</Text>
                <Text style={styles.bannerSub}>Enables answer / decline from BUS on incoming calls</Text>
              </>}
        </TouchableOpacity>
      )}
      {defaultDialer && (
        <View style={[styles.banner, styles.bannerActive]}>
          <Text style={[styles.bannerTitle, { color: '#16a34a' }]}>● BUS is your default dialer</Text>
          <Text style={styles.bannerSub}>Incoming calls show BUS caller info with Answer / Decline</Text>
        </View>
      )}

      {/* Number display */}
      <View style={styles.display}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {number || ' '}
        </Text>
        {number.length > 0 && (
          <TouchableOpacity onPress={backspace} onLongPress={() => setNumber('')} style={styles.backspaceBtn} activeOpacity={0.6}>
            <Text style={styles.backspaceIcon}>⌫</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dialpad */}
      <View style={styles.pad}>
        {KEYS.map(({ digit, sub }) => (
          <TouchableOpacity key={digit} style={styles.key} onPress={() => press(digit)} activeOpacity={0.7}>
            <Text style={styles.keyDigit}>{digit}</Text>
            {sub !== undefined && <Text style={styles.keySub}>{sub}</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Call button */}
      <TouchableOpacity
        style={[styles.callBtn, !number && styles.callBtnDisabled]}
        onPress={call}
        disabled={!number || calling}
        activeOpacity={0.85}
      >
        {calling
          ? <ActivityIndicator color={Colors.white} />
          : <Text style={styles.callIcon}>📞</Text>}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },

  banner: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  bannerActive: { borderColor: '#16a34a40' },
  bannerTitle: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.primary, marginBottom: 2 },
  bannerSub: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  display: {
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  displayText: {
    flex: 1,
    fontSize: 36,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  backspaceBtn: { padding: Spacing.sm, marginLeft: Spacing.sm },
  backspaceIcon: { fontSize: 22, color: Colors.textSecondary },

  pad: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: Spacing.xxl,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: { fontSize: 26, fontFamily: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 30 },
  keySub: { fontSize: 9, fontFamily: Fonts.semiBold, color: Colors.textSecondary, letterSpacing: 1.5, marginTop: 1 },

  callBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnDisabled: { backgroundColor: Colors.border },
  callIcon: { fontSize: 26 },
});
