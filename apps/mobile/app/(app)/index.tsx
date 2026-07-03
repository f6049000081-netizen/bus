import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, FlatList, Linking, Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { requestContactsPermission, hashAllContacts } from '../../src/services/contacts';
import { syncContacts } from '../../src/services/contactSync';
import { hashContactPhone } from '../../src/services/hashing';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';
import { LogoMark } from '../../src/components/LogoMark';

const CONTACT_HASH_VERSION_KEY = 'contact_hash_version';
const CURRENT_VERSION = 'v3'; // bump forces re-sync after incremental sync rollout

interface SearchResult {
  comparisonId: string;
  comparedAt: string;
  otherUserName: string;
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchedName, setSearchedName] = useState('');

  const doSync = async (silent = false) => {
    const granted = await requestContactsPermission();
    if (!granted) {
      if (!silent) Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Between Us needs contact access to find mutual connections.' });
      return;
    }
    setSyncing(true);
    try {
      const contacts = await hashAllContacts('');
      const { upserted, removed } = await syncContacts(contacts);

      await SecureStore.setItemAsync(CONTACT_HASH_VERSION_KEY, CURRENT_VERSION);
      setSyncNote(`${contacts.length} contacts · ${upserted} updated · ${removed} removed`);
      if (!silent) Toast.show({ type: 'success', text1: 'Contacts synced', text2: `${upserted} updated, ${removed} removed` });
    } catch (err: unknown) {
      if (!silent) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Sync failed';
        Toast.show({ type: 'error', text1: 'Sync failed', text2: msg });
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    SecureStore.getItemAsync(CONTACT_HASH_VERSION_KEY).then((v) => {
      if (v !== CURRENT_VERSION) doSync(true);
    });
  }, []);

  const handleSearch = async () => {
    const trimmed = searchPhone.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchResults(null);
    try {
      const hash = await hashContactPhone(trimmed);
      if (!hash) {
        Toast.show({ type: 'error', text1: 'Invalid number', text2: 'Use international format, e.g. +2519xxxxxxxx' });
        return;
      }
      // Resolve local name for this number
      const contacts = await hashAllContacts('');
      const match = contacts.find(c => c.hash === hash);
      setSearchedName(match?.localName ?? trimmed);

      const { data } = await getApiClient().get<SearchResult[]>(`/api/contacts/search?hash=${hash}`);
      setSearchResults(data);
    } catch {
      Toast.show({ type: 'error', text1: 'Search failed' });
    } finally {
      setSearching(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.logoRow}><LogoMark variant="hero" /></View>
      <Text style={styles.greeting}>Hi{user?.displayName ? `, ${user.displayName}` : ''}</Text>

      {/* Contact sync card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Sync</Text>
        <Text style={styles.cardBody}>
          {syncNote || 'Your contacts are hashed on-device before upload. Raw numbers never leave your phone.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => doSync(false)} disabled={syncing} activeOpacity={0.85}>
          {syncing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Sync Contacts</Text>}
        </TouchableOpacity>
      </View>

      {/* Phone number search */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Search a Number</Text>
        <Text style={styles.cardBody}>Enter a phone number to see if it appeared in any of your past comparisons.</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchPhone}
            onChangeText={setSearchPhone}
            placeholder="+2519xxxxxxxx"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching} activeOpacity={0.85}>
            {searching ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.searchBtnText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {searchResults !== null && (
          <View style={styles.resultsWrap}>
            {searchResults.length === 0 ? (
              <Text style={styles.noResults}>"{searchedName}" hasn't appeared in any of your comparisons yet.</Text>
            ) : (
              <>
                <Text style={styles.resultsHeader}>
                  "{searchedName}" found in {searchResults.length} comparison{searchResults.length !== 1 ? 's' : ''}
                </Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={r => r.comparisonId}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={styles.resultRow}>
                      <View style={styles.resultAvatar}>
                        <Text style={styles.resultAvatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.resultBody}>
                        <Text style={styles.resultName}>{item.otherUserName}</Text>
                        <Text style={styles.resultDate}>{new Date(item.comparedAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                  )}
                />
              </>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xxl },
  logoRow: { alignItems: 'center', marginTop: Spacing.xxxl, marginBottom: Spacing.xl },
  greeting: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.xxxl },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl },
  cardTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  cardBody: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, padding: Spacing.md, fontSize: FontSize.body,
    color: Colors.textPrimary, fontFamily: Fonts.regular,
  },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  searchBtnText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  resultsWrap: { marginTop: Spacing.lg },
  resultsHeader: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.md },
  noResults: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  resultAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '25', justifyContent: 'center', alignItems: 'center' },
  resultAvatarText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  resultBody: { flex: 1 },
  resultName: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  resultDate: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
