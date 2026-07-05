import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, FlatList, Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { requestContactsPermission, hashAllContacts } from '../../src/services/contacts';
import { syncContacts } from '../../src/services/contactSync';
import { hashContactPhone } from '../../src/services/hashing';
import {
  requestCallScreeningRole,
  isCallScreeningEnabled,
  updateCallerIdCache,
} from '../../src/services/callerIdService';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';
import { LogoMark } from '../../src/components/LogoMark';

const CONTACT_HASH_VERSION_KEY = 'contact_hash_version';
const CURRENT_VERSION = 'v3';

interface ComparisonResult {
  comparisonId: string;
  comparedAt: string;
  otherUserName: string;
}

interface SearchResponse {
  ownContact: boolean;
  busUser: { displayName: string; phoneHint: string } | null;
  comparisons: ComparisonResult[];
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');

  const [callerIdEnabled, setCallerIdEnabled] = useState(false);
  const [callerIdLoading, setCallerIdLoading] = useState(false);

  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [searchedName, setSearchedName] = useState('');
  const [searchError, setSearchError] = useState('');

  const doSync = async (silent = false) => {
    const granted = await requestContactsPermission();
    if (!granted) {
      if (!silent) Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Between Us needs contact access.' });
      return;
    }
    setSyncing(true);
    try {
      const contacts = await hashAllContacts('');
      const { upserted, removed } = await syncContacts(contacts);
      await SecureStore.setItemAsync(CONTACT_HASH_VERSION_KEY, CURRENT_VERSION);
      setSyncNote(`${contacts.length} contacts · ${upserted} updated · ${removed} removed`);
      updateCallerIdCache(contacts).catch(() => {});
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
    isCallScreeningEnabled().then(setCallerIdEnabled);
  }, []);

  const handleEnableCallerId = async () => {
    setCallerIdLoading(true);
    try {
      const result = await requestCallScreeningRole();
      if (result === 'GRANTED') {
        setCallerIdEnabled(true);
        Toast.show({ type: 'success', text1: 'Caller ID enabled', text2: 'BUS will identify incoming callers.' });
      } else if (result === 'DENIED') {
        Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Grant via Settings → Default apps → Caller ID.' });
      } else {
        Toast.show({ type: 'info', text1: 'Not supported', text2: 'Requires Android 10 or later.' });
      }
    } finally {
      setCallerIdLoading(false);
    }
  };

  const handleSearch = async () => {
    const trimmed = searchPhone.trim();
    if (!trimmed) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchResponse(null);
    setSearchError('');
    try {
      const hash = await hashContactPhone(trimmed);
      if (!hash) {
        setSearchError('Enter a valid international number, e.g. +2519xxxxxxxx');
        return;
      }
      const contacts = await hashAllContacts('');
      const match = contacts.find(c => c.hash === hash);
      setSearchedName(match?.localName ?? trimmed);
      const { data } = await getApiClient().get<SearchResponse>(`/api/contacts/search?hash=${hash}`);
      setSearchResponse(data);
      const hasAny = data.ownContact || data.busUser || data.comparisons.length > 0;
      if (!hasAny) setSearchError(`No results found for "${match?.localName ?? trimmed}"`);
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Compact header */}
      <View style={styles.header}>
        <LogoMark variant="inline" />
        <Text style={styles.greeting}>Hi{user?.displayName ? `, ${user.displayName}` : ''}</Text>
      </View>

      {/* Search bar — top of content */}
      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Search a number</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchPhone}
            onChangeText={(t) => {
              // Only allow +, digits, spaces, dashes, parens
              const filtered = t.replace(/[^\d+\s\-()]/g, '');
              setSearchPhone(filtered);
              setSearchError('');
              setSearchResponse(null);
            }}
            placeholder="+2519xxxxxxxx"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            maxLength={20}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching} activeOpacity={0.85}>
            {searching
              ? <ActivityIndicator color={Colors.white} size="small" />
              : <Text style={styles.searchBtnText}>Search</Text>}
          </TouchableOpacity>
        </View>

        {searchError !== '' && (
          <Text style={styles.noResults}>{searchError}</Text>
        )}

        {searchResponse !== null && (searchResponse.ownContact || searchResponse.busUser || searchResponse.comparisons.length > 0) && (
          <View style={styles.resultsWrap}>
            <Text style={styles.resultsHeader}>Results for "{searchedName}"</Text>

            {searchResponse.ownContact && (
              <View style={styles.resultRow}>
                <View style={[styles.resultAvatar, styles.resultAvatarGreen]}>
                  <Text style={[styles.resultAvatarText, styles.resultAvatarTextGreen]}>
                    {searchedName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.resultBody}>
                  <Text style={styles.resultName}>{searchedName}</Text>
                  <Text style={styles.resultBadge}>From your contacts</Text>
                </View>
              </View>
            )}

            {searchResponse.busUser && (
              <View style={styles.resultRow}>
                <View style={[styles.resultAvatar, styles.resultAvatarBlue]}>
                  <Text style={[styles.resultAvatarText, styles.resultAvatarTextBlue]}>
                    {searchResponse.busUser.displayName.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
                <View style={styles.resultBody}>
                  <Text style={styles.resultName}>{searchResponse.busUser.displayName || `…${searchResponse.busUser.phoneHint}`}</Text>
                  <Text style={styles.resultBadge}>From BUS app</Text>
                </View>
              </View>
            )}

            {searchResponse.comparisons.length > 0 && (
              <>
                <Text style={[styles.resultsHeader, { marginTop: Spacing.md }]}>
                  Shared in {searchResponse.comparisons.length} comparison{searchResponse.comparisons.length !== 1 ? 's' : ''}
                </Text>
                <FlatList
                  data={searchResponse.comparisons}
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

      {/* Contact sync card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Sync</Text>
        <Text style={styles.cardBody}>
          {syncNote || 'Contacts are hashed on-device. Raw numbers never leave your phone.'}
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => doSync(false)} disabled={syncing} activeOpacity={0.85}>
          {syncing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Sync Contacts</Text>}
        </TouchableOpacity>
      </View>

      {/* Caller ID card */}
      <View style={styles.card}>
        <View style={styles.callerIdHeader}>
          <View>
            <Text style={styles.cardTitle}>Incoming Caller ID</Text>
            <Text style={styles.callerIdStatus}>
              {callerIdEnabled ? '● Active' : '○ Not enabled'}
            </Text>
          </View>
          {callerIdEnabled && (
            <View style={styles.callerIdBadge}><Text style={styles.callerIdBadgeText}>ON</Text></View>
          )}
        </View>
        <Text style={styles.cardBody}>
          {callerIdEnabled
            ? 'BUS will show the caller\'s name from your contacts or the BUS network on incoming calls.'
            : 'Let BUS identify incoming calls. When a caller is found in your contacts or BUS network, their name appears on the call screen.'}
        </Text>
        {!callerIdEnabled && (
          <TouchableOpacity style={styles.button} onPress={handleEnableCallerId} disabled={callerIdLoading} activeOpacity={0.85}>
            {callerIdLoading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Enable Caller ID</Text>}
          </TouchableOpacity>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xl },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginTop: Spacing.xl, marginBottom: Spacing.xl,
  },
  greeting: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textSecondary },

  searchCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  searchLabel: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.body, color: Colors.textPrimary, fontFamily: Fonts.regular,
  },
  searchBtn: {
    backgroundColor: Colors.primary, borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg, justifyContent: 'center',
  },
  searchBtnText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  resultsWrap: { marginTop: Spacing.lg },
  resultsHeader: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.md },
  noResults: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  resultAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary + '25', justifyContent: 'center', alignItems: 'center' },
  resultAvatarGreen: { backgroundColor: '#16a34a25' },
  resultAvatarBlue: { backgroundColor: '#2563eb25' },
  resultAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  resultAvatarTextGreen: { color: '#16a34a' },
  resultAvatarTextBlue: { color: '#2563eb' },
  resultBody: { flex: 1 },
  resultName: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  resultDate: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary },
  resultBadge: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  cardTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  cardBody: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  callerIdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  callerIdStatus: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.sm },
  callerIdBadge: { backgroundColor: '#16a34a25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  callerIdBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#16a34a', letterSpacing: 0.5 },
});
