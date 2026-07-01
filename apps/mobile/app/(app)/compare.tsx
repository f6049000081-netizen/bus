import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { getApiClient, ComparisonSession } from '@bus/shared';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

interface SessionStatus {
  id: string;
  token: string;
  expiresAt: string;
  used: boolean;
  comparisonId: string | null;
}

export default function CompareScreen() {
  const [session, setSession] = useState<ComparisonSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const startPolling = (sessionId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getApiClient().get<SessionStatus>(`/api/comparison/session/${sessionId}`);
        if (data.used && data.comparisonId) {
          stopPolling();
          setWaiting(false);
          router.push({ pathname: '/result/[id]', params: { id: data.comparisonId } } as never);
        } else if (new Date(data.expiresAt) < new Date()) {
          stopPolling();
          setWaiting(false);
          Toast.show({ type: 'info', text1: 'Session expired', text2: 'Generate a new QR code' });
          setSession(null);
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  };

  const createSession = async () => {
    setLoading(true);
    try {
      const { data } = await getApiClient().post<ComparisonSession>('/api/comparison/session');
      setSession(data);
      setWaiting(true);
      startPolling(data.id);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not create session' });
    } finally {
      setLoading(false);
    }
  };

  const shareLink = async () => {
    if (!session) return;
    const link = `bus://compare/${session.token}`;
    await Share.share({ message: `Let's see who we both know! Open Between Us: ${link}` });
  };

  const reset = () => {
    stopPolling();
    setSession(null);
    setWaiting(false);
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

          {waiting ? (
            <View style={styles.waitRow}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.waitText}>Waiting for partner to scan…</Text>
            </View>
          ) : (
            <Text style={styles.expiry}>Expires {new Date(session.expiresAt).toLocaleTimeString()}</Text>
          )}

          <TouchableOpacity style={styles.shareButton} onPress={shareLink} activeOpacity={0.85}>
            <Text style={styles.shareText}>Share Link Instead</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetButton} onPress={reset} activeOpacity={0.85}>
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
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  waitText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.primary },
  expiry: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.warning },
  shareButton: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radii.button, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  shareText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.primary },
  resetButton: { paddingVertical: Spacing.sm },
  resetText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
