import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useQuery } from '@tanstack/react-query';
import { getApiClient } from '@bus/shared';
import { hashAllContacts, requestContactsPermission } from '../src/services/contacts';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../src/constants/theme';

interface MutualItem { contactHash: string; yourFrequency: string; theirFrequency: string }
interface ComparisonResult { id: string; mutualCount: number; mutuals: MutualItem[]; createdAt: string }
interface ComparisonListItem { id: string; mutualCount: number; createdAt: string }

export default function WarmIntroScreen() {
  const { anchorId } = useLocalSearchParams<{ anchorId: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bridgeContacts, setBridgeContacts] = useState<Array<{ hash: string; name: string }> | null>(null);
  const [computing, setComputing] = useState(false);

  const { data: history } = useQuery({
    queryKey: ['comparisons'],
    queryFn: async () => {
      const { data } = await getApiClient().get<ComparisonListItem[]>('/api/comparison');
      return data;
    },
  });

  const otherComparisons = history?.filter(c => c.id !== anchorId) ?? [];

  const findBridges = useCallback(async () => {
    if (!selectedId || !anchorId) return;
    setComputing(true);
    setBridgeContacts(null);
    try {
      const [{ data: a }, { data: b }] = await Promise.all([
        getApiClient().get<ComparisonResult>(`/api/comparison/${anchorId}`),
        getApiClient().get<ComparisonResult>(`/api/comparison/${selectedId}`),
      ]);

      const setA = new Set(a.mutuals.map(m => m.contactHash));
      const bridges = b.mutuals.filter(m => setA.has(m.contactHash));

      if (bridges.length === 0) {
        setBridgeContacts([]);
        return;
      }

      const granted = await requestContactsPermission();
      if (!granted) {
        setBridgeContacts(bridges.map(br => ({ hash: br.contactHash, name: 'Unknown Contact' })));
        return;
      }

      const hashed = await hashAllContacts('');
      const hashToName = new Map(hashed.map(h => [h.hash, h.localName ?? 'Unknown Contact']));
      setBridgeContacts(bridges.map(br => ({ hash: br.contactHash, name: hashToName.get(br.contactHash) ?? 'Unknown Contact' })));
    } catch {
      Toast.show({ type: 'error', text1: 'Could not compute bridges' });
    } finally {
      setComputing(false);
    }
  }, [anchorId, selectedId]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Warm Intro Finder</Text>
      <Text style={styles.sub}>Pick a second comparison to find contacts who know both people — they could make an introduction.</Text>

      {otherComparisons.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>You need at least 2 past comparisons to use this feature.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Compare with:</Text>
          <FlatList
            data={otherComparisons}
            keyExtractor={item => item.id}
            style={styles.pickList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickItem, selectedId === item.id && styles.pickItemSelected]}
                onPress={() => { setSelectedId(item.id); setBridgeContacts(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickText, selectedId === item.id && { color: Colors.primary }]}>
                  {item.mutualCount} mutual · {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>
            )}
          />

          {selectedId && (
            <TouchableOpacity style={styles.findBtn} onPress={findBridges} disabled={computing} activeOpacity={0.85}>
              {computing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.findBtnText}>Find Bridge Contacts</Text>}
            </TouchableOpacity>
          )}

          {bridgeContacts !== null && (
            <View style={styles.results}>
              {bridgeContacts.length === 0 ? (
                <Text style={styles.noResults}>No shared mutual contacts found between these two comparisons.</Text>
              ) : (
                <>
                  <Text style={styles.resultsTitle}>{bridgeContacts.length} bridge contact{bridgeContacts.length !== 1 ? 's' : ''}</Text>
                  {bridgeContacts.map(c => (
                    <View key={c.hash} style={styles.bridgeCard}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.bridgeName}>{c.name}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl },
  back: { marginTop: Spacing.xxxl, marginBottom: Spacing.lg },
  backText: { fontSize: FontSize.body, color: Colors.primary },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  sub: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.xl },
  sectionLabel: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  pickList: { maxHeight: 200, marginBottom: Spacing.lg },
  pickItem: { backgroundColor: Colors.surface, borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  pickItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  pickText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textPrimary },
  findBtn: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.xl },
  findBtnText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
  results: { gap: Spacing.md },
  resultsTitle: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  noResults: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22 },
  bridgeCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '30', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  bridgeName: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  emptyCard: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xxl, borderWidth: 1, borderColor: Colors.border },
  emptyText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22 },
});
