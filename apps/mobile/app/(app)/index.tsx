import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { requestContactsPermission, hashAllContacts } from '../../src/services/contacts';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

export default function HomeScreen() {
  const { user, salt } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleSync = async () => {
    if (!salt) { Toast.show({ type: 'error', text1: 'Not signed in' }); return; }
    const granted = await requestContactsPermission();
    if (!granted) {
      Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Between Us needs contact access to find mutual connections.' });
      return;
    }
    setSyncing(true);
    try {
      const hashes = await hashAllContacts(salt);
      await getApiClient().post('/api/contacts/sync', {
        hashes: hashes.map((h) => ({ hash: h.hash, frequencyBucket: h.frequencyBucket })),
      });
      setSynced(true);
      const withFrequency = hashes.filter(h => h.frequencyBucket !== 'unknown').length;
      const freqNote = withFrequency > 0
        ? `${hashes.length} contacts · ${withFrequency} with call frequency`
        : `${hashes.length} contacts synced`;
      Toast.show({ type: 'success', text1: 'Contacts synced', text2: freqNote });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Sync failed';
      Toast.show({ type: 'error', text1: 'Sync failed', text2: msg });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hi{user?.displayName ? `, ${user.displayName}` : ''}</Text>
      <Text style={styles.sub}>Sync your contacts once to start finding mutual connections.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Sync</Text>
        <Text style={styles.cardBody}>
          {synced
            ? 'Your contacts are synced. Tap Compare to find mutual connections with someone new.'
            : 'Your contacts are hashed on-device before upload. Raw numbers never leave your phone.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleSync} disabled={syncing} activeOpacity={0.85}>
          {syncing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>{synced ? 'Re-sync Contacts' : 'Sync Contacts'}</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xxl },
  greeting: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: Spacing.xxxl, marginBottom: Spacing.sm },
  sub: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  cardTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  cardBody: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
});
