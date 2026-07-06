import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput, AppState, Linking, Keyboard,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { requestContactsPermission, hashAllContacts, findContactByPhone } from '../../src/services/contacts';
import { syncContacts } from '../../src/services/contactSync';
import { hashContactPhone } from '../../src/services/hashing';
import {
  requestCallScreeningRole,
  isCallScreeningEnabled,
  updateCallerIdCache,
} from '../../src/services/callerIdService';
import { getRecentCalls, type RecentCall } from '../../src/services/callLog';
import { bulkLookupNumbers, type BusLookupResult } from '../../src/services/busLookup';
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
  inBusDatabase: number;
  savedByUsers: Array<{ displayName: string; phoneHint: string }>;
  comparisons: ComparisonResult[];
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7)   return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

const CALL_ICON: Record<string, { icon: string; color: string }> = {
  incoming:  { icon: '↙', color: '#2563eb' },
  outgoing:  { icon: '↗', color: '#16a34a' },
  missed:    { icon: '✕', color: '#dc2626' },
  rejected:  { icon: '✕', color: '#dc2626' },
  unknown:   { icon: '·', color: Colors.textSecondary ?? '#888' },
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const [contactsPermDenied, setContactsPermDenied] = useState(false);

  const [callerIdEnabled, setCallerIdEnabled] = useState(false);
  const [callerIdLoading, setCallerIdLoading] = useState(false);

  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchedPhone, setSearchedPhone] = useState('');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [searchedName, setSearchedName] = useState('');
  const [searchError, setSearchError] = useState('');

  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [busNames, setBusNames] = useState<Map<string, BusLookupResult>>(new Map());
  // hash → local contact name: built once during sync, used for instant search lookup
  const [contactsMap, setContactsMap] = useState<Map<string, string>>(new Map());

  const loadRecentCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      const calls = await getRecentCalls(30);
      setRecentCalls(calls);
      if (calls.length > 0) {
        const unique = [...new Set(calls.map((c) => c.number))];
        bulkLookupNumbers(unique).then(setBusNames).catch(() => {});
      }
    } finally {
      setCallsLoading(false);
    }
  }, []);

  const doSync = useCallback(async (silent = false) => {
    const granted = await requestContactsPermission();
    if (!granted) {
      setContactsPermDenied(true);
      if (!silent) Toast.show({ type: 'error', text1: 'Permission denied', text2: 'Enable contacts access in Settings.' });
      return;
    }
    setContactsPermDenied(false);
    setSyncing(true);
    try {
      const contacts = await hashAllContacts('');
      const { upserted, removed } = await syncContacts(contacts);
      await SecureStore.setItemAsync(CONTACT_HASH_VERSION_KEY, CURRENT_VERSION);
      setSyncNote(`${contacts.length} contacts · ${upserted} updated · ${removed} removed`);
      updateCallerIdCache(contacts).catch(() => {});
      const map = new Map<string, string>();
      for (const c of contacts) { if (c.localName) map.set(c.hash, c.localName); }
      setContactsMap(map);
      if (!silent) Toast.show({ type: 'success', text1: 'Contacts synced', text2: `${upserted} updated, ${removed} removed` });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Sync failed';
      Toast.show({ type: 'error', text1: 'Sync failed', text2: msg });
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    doSync(true); // always silently sync on startup

    isCallScreeningEnabled().then((enabled) => {
      setCallerIdEnabled(enabled);
      if (!enabled) {
        // Auto-prompt to set BUS as the default caller ID app on first open
        setTimeout(async () => {
          const result = await requestCallScreeningRole();
          if (result === 'GRANTED') setCallerIdEnabled(true);
        }, 800);
      }
    });

    loadRecentCalls();

    // Refresh call list every 30 seconds
    const interval = setInterval(loadRecentCalls, 30_000);

    // Refresh when app comes back to foreground
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadRecentCalls();
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [loadRecentCalls, doSync]);

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
    setSearchedPhone(trimmed);
    try {
      const hash = await hashContactPhone(trimmed);
      if (!hash) {
        setSearchError('Enter a valid number, e.g. +2519xxxxxxxx or 09xxxxxxxx');
        return;
      }

      // Step 1: check device contacts — map (O(1)) then direct fallback if map not yet built
      let localName = contactsMap.get(hash) ?? '';
      if (!localName && contactsMap.size === 0) {
        localName = (await findContactByPhone(trimmed)) ?? '';
      }
      setSearchedName(localName);

      // Step 2: query BUS database
      const { data } = await getApiClient().get<SearchResponse>(`/api/contacts/search?hash=${hash}`);
      setSearchResponse(data);

      const hasAny =
        localName ||
        data.ownContact ||
        data.busUser ||
        (data.savedByUsers?.length ?? 0) > 0 ||
        data.comparisons.length > 0;
      if (!hasAny) setSearchError(`"${trimmed}" was not found in your contacts or BUS`);
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  };

  const tapCallNumber = (number: string) => {
    setSearchPhone(number);
    setSearchResponse(null);
    setSearchError('');
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Header */}
      <View style={styles.header}>
        <LogoMark variant="inline" />
        {user?.displayName ? <Text style={styles.greeting}>{user.displayName}</Text> : null}
      </View>

      {/* Search */}
      <View style={styles.searchCard}>
        <Text style={styles.searchLabel}>Search a number</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchPhone}
            onChangeText={(t) => {
              const filtered = t.replace(/[^\d+\s\-()]/g, '');
              setSearchPhone(filtered);
              setSearchError('');
              setSearchResponse(null);
            }}
            placeholder="+2519xxxxxxxx or 09xxxxxxxx"
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

        {searchError !== '' && <Text style={styles.noResults}>{searchError}</Text>}

        {searchResponse !== null && (
          <View style={styles.resultsWrap}>

            {/* ── Your phone contacts ── */}
            <Text style={styles.sectionLabel}>Your contacts</Text>
            {(searchedName || searchResponse.ownContact) ? (
              <View style={styles.resultRow}>
                <View style={[styles.resultAvatar, styles.avatarGreen]}>
                  <Text style={[styles.avatarText, styles.avatarTextGreen]}>
                    {(searchedName || searchedPhone).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.resultBody}>
                  <Text style={styles.resultName}>{searchedName || searchedPhone}</Text>
                  <Text style={styles.resultSub}>{searchedPhone} · Saved on your phone</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.notFoundNote}>Not in your contacts</Text>
            )}

            {/* ── BUS database ── */}
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>BUS database</Text>

            {!searchResponse.busUser && (searchResponse.savedByUsers?.length ?? 0) === 0 && searchResponse.comparisons.length === 0 && (
              <Text style={styles.notFoundNote}>Not found in BUS</Text>
            )}

            {searchResponse.busUser && (
              <View style={styles.resultRow}>
                <View style={[styles.resultAvatar, styles.avatarBlue]}>
                  <Text style={[styles.avatarText, styles.avatarTextBlue]}>
                    {(searchResponse.busUser.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.resultBody}>
                  <Text style={styles.resultName}>
                    {searchResponse.busUser.displayName || `…${searchResponse.busUser.phoneHint}`}
                  </Text>
                  <Text style={styles.resultSub}>{searchedPhone} · BUS user</Text>
                </View>
                <View style={styles.busBadgePill}>
                  <Text style={styles.busBadgePillText}>BUS</Text>
                </View>
              </View>
            )}

            {(searchResponse.savedByUsers?.length ?? 0) > 0 && (
              <>
                <Text style={styles.subLabel}>
                  Saved by {searchResponse.savedByUsers.length} BUS user{searchResponse.savedByUsers.length !== 1 ? 's' : ''}
                </Text>
                {searchResponse.savedByUsers.map((u, i) => (
                  <View key={i} style={styles.resultRow}>
                    <View style={[styles.resultAvatar, styles.avatarOrange]}>
                      <Text style={[styles.avatarText, styles.avatarTextOrange]}>
                        {(u.displayName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultName}>{u.displayName || `…${u.phoneHint}`}</Text>
                      <Text style={styles.resultSub}>Has {searchedPhone} in their contacts</Text>
                    </View>
                    <View style={styles.busBadgePill}>
                      <Text style={styles.busBadgePillText}>BUS</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {searchResponse.comparisons.length > 0 && (
              <>
                <Text style={styles.subLabel}>
                  Appeared in {searchResponse.comparisons.length} comparison{searchResponse.comparisons.length !== 1 ? 's' : ''}
                </Text>
                {searchResponse.comparisons.map(item => (
                  <View key={item.comparisonId} style={styles.resultRow}>
                    <View style={styles.resultAvatar}>
                      <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.resultBody}>
                      <Text style={styles.resultName}>{item.otherUserName}</Text>
                      <Text style={styles.resultSub}>{new Date(item.comparedAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

          </View>
        )}
      </View>

      {/* Section separator */}
      <View style={styles.sectionSep} />

      {/* Recent calls */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Recent Calls</Text>
          <TouchableOpacity onPress={loadRecentCalls} disabled={callsLoading}>
            {callsLoading
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={styles.refreshBtn}>Refresh</Text>}
          </TouchableOpacity>
        </View>

        {recentCalls.length === 0 && !callsLoading && (
          <Text style={styles.cardBody}>No recent calls found.</Text>
        )}

        {recentCalls.map((call, i) => {
          const meta = CALL_ICON[call.type] ?? CALL_ICON.unknown;
          const busInfo = busNames.get(call.number);
          // Prefer device contact name, then BUS name, then raw number
          const displayName = call.cachedName || busInfo?.displayName || call.number;
          const fromBus = !call.cachedName && !!busInfo;
          const subParts: string[] = [];
          if (displayName !== call.number) subParts.push(call.number);
          if (fromBus && busInfo?.source === 'in_contacts' && busInfo.savedBy.length > 0) {
            subParts.push(`saved by ${busInfo.savedBy.slice(0, 2).join(', ')}`);
          }
          subParts.push(relativeTime(call.date));
          if (call.type === 'incoming' && call.duration > 0) {
            subParts.push(`${Math.floor(call.duration / 60)}m${call.duration % 60}s`);
          }
          return (
            <TouchableOpacity key={i} style={styles.callRow} onPress={() => tapCallNumber(call.number)} activeOpacity={0.7}>
              <View style={[styles.callTypeBox, { backgroundColor: meta.color + '20' }]}>
                <Text style={[styles.callTypeIcon, { color: meta.color }]}>{meta.icon}</Text>
              </View>
              <View style={styles.resultBody}>
                <View style={styles.callNameRow}>
                  <Text style={[styles.resultName, { flexShrink: 1 }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {fromBus && (
                    <View style={styles.busBadgePill}>
                      <Text style={styles.busBadgePillText}>BUS</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {subParts.join(' · ')}
                </Text>
              </View>
              <Text style={styles.callSearchHint}>→</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contact sync */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Contact Sync</Text>
        {contactsPermDenied ? (
          <>
            <Text style={[styles.cardBody, { color: Colors.warning }]}>
              Contacts permission is required. Please enable it in your phone settings.
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()} activeOpacity={0.85}>
              <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.cardBody}>
              {syncNote || 'Contacts are hashed on-device. Raw numbers never leave your phone.'}
            </Text>
            <TouchableOpacity style={styles.button} onPress={() => doSync(false)} disabled={syncing} activeOpacity={0.85}>
              {syncing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Sync Contacts</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Caller ID */}
      <View style={styles.card}>
        <View style={styles.callerIdHeader}>
          <View>
            <Text style={styles.cardTitle}>Incoming Caller ID</Text>
            <Text style={styles.callerIdStatus}>{callerIdEnabled ? '● Active' : '○ Not enabled'}</Text>
          </View>
          {callerIdEnabled && (
            <View style={styles.callerIdBadge}><Text style={styles.callerIdBadgeText}>ON</Text></View>
          )}
        </View>
        <Text style={styles.cardBody}>
          {callerIdEnabled
            ? "BUS will show the caller's name from your contacts or the BUS network on incoming calls."
            : 'Let BUS identify incoming calls. When a caller is in your contacts or BUS network, their name appears on the call screen.'}
        </Text>
        {!callerIdEnabled && (
          <TouchableOpacity style={styles.button} onPress={handleEnableCallerId} disabled={callerIdLoading} activeOpacity={0.85}>
            {callerIdLoading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.buttonText}>Enable Caller ID</Text>}
          </TouchableOpacity>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xl, marginBottom: Spacing.xl },
  greeting: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textSecondary },

  searchCard: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl,
  },
  searchLabel: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.8 },
  searchRow: { flexDirection: 'row', gap: Spacing.sm },
  searchInput: {
    flex: 1, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.body, color: Colors.textPrimary, fontFamily: Fonts.regular,
  },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, justifyContent: 'center' },
  searchBtnText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  noResults: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20, marginTop: Spacing.md },
  resultsWrap: { marginTop: Spacing.lg },
  resultsHeader: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  sectionLabel: {
    fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, paddingBottom: 4,
  },
  subLabel: {
    fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.textSecondary,
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  notFoundNote: {
    fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary,
    fontStyle: 'italic', marginBottom: Spacing.sm,
  },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  resultAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '25', justifyContent: 'center', alignItems: 'center' },
  avatarGreen: { backgroundColor: '#16a34a25' },
  avatarBlue:  { backgroundColor: '#2563eb25' },
  avatarOrange: { backgroundColor: '#ea580c25' },
  avatarText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  avatarTextGreen:  { color: '#16a34a' },
  avatarTextBlue:   { color: '#2563eb' },
  avatarTextOrange: { color: '#ea580c', fontSize: 10 },
  resultBody: { flex: 1 },
  resultName: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  resultSub:  { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radii.card,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xl,
  },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  cardTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  cardBody:  { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  refreshBtn: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.primary },
  button: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },

  callRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  callTypeBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  callTypeIcon: { fontSize: 16, fontWeight: '700' },
  callSearchHint: { fontSize: 11, color: Colors.textSecondary, fontFamily: Fonts.regular },
  callNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'nowrap' },
  busBadgePill: {
    backgroundColor: Colors.primary + '30',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  busBadgePillText: {
    fontSize: 9,
    fontFamily: Fonts.semiBold,
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },

  sectionSep: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xl,
    opacity: 0.6,
  },

  callerIdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  callerIdStatus: { fontSize: FontSize.small, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: Spacing.sm },
  callerIdBadge: { backgroundColor: '#16a34a25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  callerIdBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#16a34a', letterSpacing: 0.5 },
});
