import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

export default function PrivacyScreen() {
  const { logout } = useAuthStore();
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const deleteContacts = () => {
    Alert.alert('Delete Contact Hashes', "This removes all your contact fingerprints from our servers. You'll need to re-sync before comparing again.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(true);
        try {
          await getApiClient().delete('/api/contacts');
          Toast.show({ type: 'success', text1: 'Contact hashes deleted' });
        } catch {
          Toast.show({ type: 'error', text1: 'Delete failed' });
        } finally {
          setDeleting(false);
        }
      }},
    ]);
  };

  const deleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently deletes your account and all associated data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
        setDeletingAccount(true);
        try {
          await getApiClient().delete('/api/user/me');
          await logout();
        } catch {
          Toast.show({ type: 'error', text1: 'Delete failed' });
          setDeletingAccount(false);
        }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy Controls</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>What Between Us stores</Text>
        {[
          'Encrypted contact fingerprints (hashed phone numbers — not raw contacts)',
          'Frequency buckets (frequent/occasional/rare — not call counts)',
          'Mutual contact lists from past comparisons',
          'Your display name and last-4-digit phone hint',
        ].map((item, i) => (
          <View key={i} style={styles.item}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delete your data</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={deleteContacts} disabled={deleting} activeOpacity={0.85}>
          {deleting ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.dangerText}>Delete Contact Hashes</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.dangerBtn, { borderColor: Colors.danger, backgroundColor: Colors.danger + '15' }]} onPress={deleteAccount} disabled={deletingAccount} activeOpacity={0.85}>
          {deletingAccount ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.dangerText}>Delete Entire Account</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: Spacing.xxxl, marginBottom: Spacing.xl },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl },
  cardTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.md },
  item: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: { color: Colors.primaryLight },
  itemText: { flex: 1, fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 21 },
  dangerBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radii.button, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
  dangerText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.danger },
});
