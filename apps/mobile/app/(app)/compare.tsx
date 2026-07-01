import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { getApiClient, ComparisonSession } from '@bus/shared';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

export default function CompareScreen() {
  const [session, setSession] = useState<ComparisonSession | null>(null);
  const [loading, setLoading] = useState(false);

  const createSession = async () => {
    setLoading(true);
    try {
      const { data } = await getApiClient().post<ComparisonSession>('/api/comparison/session');
      setSession(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not create session' });
    } finally {
      setLoading(false);
    }
  };

  const shareLink = async () => {
    if (!session) return;
    await Share.share({ message: `Let's see who we both know! Open Between Us: bus://compare/${session.token}` });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare Contacts</Text>
      <Text style={styles.sub}>Generate a one-time code and share it with someone to find your mutual contacts.</Text>
      {!session ? (
        <TouchableOpacity style={styles.button} onPress={createSession} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Generate QR Code</Text>}
        </TouchableOpacity>
      ) : (
        <View style={styles.qrCard}>
          <QRCode value={`bus://compare/${session.token}`} size={200} color={Colors.textPrimary} backgroundColor={Colors.surface} />
          <Text style={styles.tokenText}>Token: {session.token.slice(0, 8)}…</Text>
          <Text style={styles.expiry}>Expires in 10 minutes</Text>
          <TouchableOpacity style={styles.shareButton} onPress={shareLink} activeOpacity={0.85}>
            <Text style={styles.shareText}>Share Link Instead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={() => setSession(null)} activeOpacity={0.85}>
            <Text style={styles.resetText}>Generate New</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl, justifyContent: 'center' },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sub: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xxxl },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  qrCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xxl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tokenText: { fontSize: FontSize.caption, fontFamily: Fonts.regular, color: Colors.textSecondary },
  expiry: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.warning },
  shareButton: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radii.button, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  shareText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.primary },
  resetButton: { paddingVertical: Spacing.sm },
  resetText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
