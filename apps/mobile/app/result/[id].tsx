import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getApiClient } from '@bus/shared';
import { hashAllContacts, HashedContact, requestContactsPermission } from '../../src/services/contacts';

interface MutualItem {
  contactHash: string;
  yourFrequency: string;
  theirFrequency: string;
  yourWeekCount: number;
  theirWeekCount: number;
  yourMonthCount: number;
  theirMonthCount: number;
  yourTotalCount: number;
  theirTotalCount: number;
}

interface EnrichedMutual extends MutualItem {
  name: string;
  combinedScore: number;
  recentScore: number;
}

interface ComparisonResult {
  id: string;
  mutualCount: number;
  mutuals: MutualItem[];
  createdAt: string;
}

type Tab = 'recent' | 'top10';

const Colors = {
  background: '#0F172A', surface: '#1E293B', border: '#334155',
  primary: '#6366F1', success: '#10B981', warning: '#F59E0B',
  textPrimary: '#F1F5F9', textSecondary: '#94A3B8',
};

function recentLabel(item: EnrichedMutual): string {
  const week = item.yourWeekCount + item.theirWeekCount;
  const month = item.yourMonthCount + item.theirMonthCount;
  if (week > 0) return `${week} interaction${week !== 1 ? 's' : ''} this week`;
  if (month > 0) return `${month} interaction${month !== 1 ? 's' : ''} this month`;
  return 'in both address books';
}

function totalLabel(item: EnrichedMutual): string {
  if (item.combinedScore > 0) return `${item.combinedScore} combined interaction${item.combinedScore !== 1 ? 's' : ''}`;
  return 'in both address books';
}

function ContactRow({ item, labelFn }: { item: EnrichedMutual; labelFn: (i: EnrichedMutual) => string }) {
  const initial = item.name.charAt(0).toUpperCase() || '?';
  const week = item.yourWeekCount + item.theirWeekCount;
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.label}>{labelFn(item)}</Text>
      </View>
      {week > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>this week</Text>
        </View>
      )}
    </View>
  );
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mutuals, setMutuals] = useState<EnrichedMutual[]>([]);
  const [mutualCount, setMutualCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('recent');

  const resolveNames = useCallback(async (items: MutualItem[]): Promise<Record<string, string>> => {
    const map: Record<string, string> = {};
    const granted = await requestContactsPermission();
    if (!granted || items.length === 0) return map;
    const hashed: HashedContact[] = await hashAllContacts('');
    const mutualSet = new Set(items.map(m => m.contactHash));
    for (const h of hashed) {
      if (h.localName && mutualSet.has(h.hash)) map[h.hash] = h.localName;
    }
    return map;
  }, []);

  useEffect(() => {
    if (!id) return;
    getApiClient().get<ComparisonResult>(`/api/comparison/${id}`)
      .then(async ({ data }) => {
        setMutualCount(data.mutualCount);
        const nameMap = await resolveNames(data.mutuals);
        const enriched: EnrichedMutual[] = data.mutuals.map(m => ({
          ...m,
          name: nameMap[m.contactHash] ?? 'Unknown Contact',
          combinedScore: m.yourTotalCount + m.theirTotalCount,
          recentScore: (m.yourWeekCount + m.theirWeekCount) * 4 + (m.yourMonthCount + m.theirMonthCount),
        }));
        setMutuals(enriched);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, resolveNames]);

  const hasCallData = mutuals.some(m => m.combinedScore > 0);

  const recentList = hasCallData
    ? [...mutuals]
        .filter(m => m.yourMonthCount + m.theirMonthCount > 0)
        .sort((a, b) => b.recentScore - a.recentScore)
    : [...mutuals].sort((a, b) => a.name.localeCompare(b.name));

  const top10List = hasCallData
    ? [...mutuals]
        .filter(m => m.combinedScore > 0)
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, 10)
    : [...mutuals].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10);

  const activeList = tab === 'recent' ? recentList : top10List;
  const labelFn = tab === 'recent' ? recentLabel : totalLabel;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Comparing contacts…</Text>
      </View>
    );
  }

  if (mutualCount === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🤷</Text>
        <Text style={styles.emptyTitle}>No mutual contacts</Text>
        <Text style={styles.emptyBody}>
          You don't share any contacts yet, or their contacts aren't synced.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(app)' as never)} style={styles.backBtn}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activeList}
        keyExtractor={item => item.contactHash}
        renderItem={({ item }) => <ContactRow item={item} labelFn={labelFn} />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.replace('/(app)' as never)} style={styles.backBtnRow}>
                <Text style={styles.backText}>← Home</Text>
              </TouchableOpacity>
              <Text style={styles.title}>
                {mutualCount} mutual contact{mutualCount !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'recent' && styles.tabActive]}
                onPress={() => setTab('recent')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>
                  Recently contacted
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'top10' && styles.tabActive]}
                onPress={() => setTab('top10')}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, tab === 'top10' && styles.tabTextActive]}>
                  Top 10
                </Text>
              </TouchableOpacity>
            </View>

            {!hasCallData && (
              <View style={styles.noDataBanner}>
                <Text style={styles.noDataText}>
                  Call & SMS data unavailable — showing contacts alphabetically.
                  Sync contacts from a real device build for activity-based ranking.
                </Text>
              </View>
            )}

            {hasCallData && activeList.length === 0 && (
              <View style={styles.noDataBanner}>
                <Text style={styles.noDataText}>
                  {tab === 'recent'
                    ? 'None of your mutual contacts have been contacted in the last 30 days.'
                    : 'No call or SMS interactions recorded yet.'}
                </Text>
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  backBtnRow: { marginBottom: 16 },
  backText: { fontSize: 15, color: Colors.primary },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 8,
    backgroundColor: Colors.surface, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: '#fff' },
  noDataBanner: {
    marginHorizontal: 20, marginBottom: 12, padding: 12,
    backgroundColor: Colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  noDataText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  listContent: { paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 8,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '25',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  label: { fontSize: 12, color: Colors.textSecondary },
  badge: {
    backgroundColor: Colors.success + '20', borderRadius: 99,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.success + '60',
  },
  badgeText: { fontSize: 10, fontWeight: '600', color: Colors.success },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary + '20', borderRadius: 12 },
});
