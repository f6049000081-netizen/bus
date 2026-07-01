import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, ActivityIndicator,
  TouchableOpacity, SectionListData,
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
  bothActive: boolean;
}

interface Section {
  key: string;
  title: string;
  subtitle: string;
  data: EnrichedMutual[];
}

interface ComparisonResult {
  id: string;
  mutualCount: number;
  mutuals: MutualItem[];
  createdAt: string;
}

const Colors = {
  background: '#0F172A', surface: '#1E293B', border: '#334155',
  primary: '#6366F1', success: '#10B981', warning: '#F59E0B',
  danger: '#EF4444', textPrimary: '#F1F5F9', textSecondary: '#94A3B8',
  accent: '#8B5CF6',
};

function buildSections(mutuals: EnrichedMutual[]): Section[] {
  const sorted = [...mutuals].sort((a, b) => b.combinedScore - a.combinedScore);

  // Section 1: Top 10 by combined call volume (only if any calls exist)
  const hasCallData = sorted.some(m => m.combinedScore > 0);
  const top10 = hasCallData ? sorted.filter(m => m.combinedScore > 0).slice(0, 10) : [];
  const top10Set = new Set(top10.map(m => m.contactHash));

  // Section 2: Active this week (either user has week calls), not in top 10
  const thisWeek = sorted.filter(
    m => !top10Set.has(m.contactHash) && (m.yourWeekCount + m.theirWeekCount) > 0
  );
  const weekSet = new Set(thisWeek.map(m => m.contactHash));

  // Section 3: Active this month, not in above
  const thisMonth = sorted.filter(
    m => !top10Set.has(m.contactHash) && !weekSet.has(m.contactHash) &&
      (m.yourMonthCount + m.theirMonthCount) > 0
  );
  const monthSet = new Set(thisMonth.map(m => m.contactHash));

  // Section 4: Called by both (mutual callers), not in above
  const calledByBoth = sorted.filter(
    m => !top10Set.has(m.contactHash) && !weekSet.has(m.contactHash) &&
      !monthSet.has(m.contactHash) && m.bothActive
  );
  const bothSet = new Set(calledByBoth.map(m => m.contactHash));

  // Section 5: Everyone else
  const others = sorted.filter(
    m => !top10Set.has(m.contactHash) && !weekSet.has(m.contactHash) &&
      !monthSet.has(m.contactHash) && !bothSet.has(m.contactHash)
  );

  const sections: Section[] = [];

  if (top10.length > 0) {
    sections.push({
      key: 'top10',
      title: 'Top 10 Together',
      subtitle: 'Your highest combined call volume mutual contacts',
      data: top10,
    });
  }
  if (thisWeek.length > 0) {
    sections.push({
      key: 'week',
      title: 'Active This Week',
      subtitle: 'Called in the last 7 days by either of you',
      data: thisWeek,
    });
  }
  if (thisMonth.length > 0) {
    sections.push({
      key: 'month',
      title: 'Active This Month',
      subtitle: 'Called in the last 30 days by either of you',
      data: thisMonth,
    });
  }
  if (calledByBoth.length > 0) {
    sections.push({
      key: 'both',
      title: 'Called by Both of You',
      subtitle: 'Contacts you both actively call',
      data: calledByBoth,
    });
  }
  if (others.length > 0) {
    sections.push({
      key: 'others',
      title: 'Other Mutual Contacts',
      subtitle: 'In both your address books',
      data: others,
    });
  }

  return sections;
}

function callLabel(item: EnrichedMutual): string {
  const total = item.yourTotalCount + item.theirTotalCount;
  const week = item.yourWeekCount + item.theirWeekCount;
  const month = item.yourMonthCount + item.theirMonthCount;
  if (week > 0) return `${week} call${week !== 1 ? 's' : ''} this week`;
  if (month > 0) return `${month} call${month !== 1 ? 's' : ''} this month`;
  if (total > 0) return `${total} combined call${total !== 1 ? 's' : ''}`;
  return item.yourFrequency !== 'unknown' ? item.yourFrequency : 'in both address books';
}

function ContactCard({ item }: { item: EnrichedMutual }) {
  const initial = item.name.charAt(0).toUpperCase() || '?';
  const label = callLabel(item);
  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
        {item.bothActive && <View style={styles.bothDot} />}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.callLabel}>{label}</Text>
      </View>
      {(item.yourWeekCount > 0 || item.theirWeekCount > 0) && (
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>this week</Text>
        </View>
      )}
    </View>
  );
}

function SectionHeader({ section }: { section: SectionListData<EnrichedMutual, Section> }) {
  const icons: Record<string, string> = {
    top10: '⭐',
    week: '📅',
    month: '📆',
    both: '🤝',
    others: '👥',
  };
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionIcon}>{icons[section.key] ?? '📋'}</Text>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.sectionCount}>
          <Text style={styles.sectionCountText}>{section.data.length}</Text>
        </View>
      </View>
      <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sections, setSections] = useState<Section[]>([]);
  const [mutualCount, setMutualCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const resolveAndBuild = useCallback(async (mutuals: MutualItem[]) => {
    let nameMap: Record<string, string> = {};
    const granted = await requestContactsPermission();
    if (granted && mutuals.length > 0) {
      const hashed: HashedContact[] = await hashAllContacts('');
      const mutualSet = new Set(mutuals.map(m => m.contactHash));
      for (const h of hashed) {
        if (h.localName && mutualSet.has(h.hash)) nameMap[h.hash] = h.localName;
      }
    }

    const enriched: EnrichedMutual[] = mutuals.map(m => ({
      ...m,
      name: nameMap[m.contactHash] ?? 'Unknown Contact',
      combinedScore: m.yourTotalCount + m.theirTotalCount,
      bothActive: m.yourTotalCount > 0 && m.theirTotalCount > 0,
    }));

    setSections(buildSections(enriched));
  }, []);

  useEffect(() => {
    if (!id) return;
    getApiClient().get<ComparisonResult>(`/api/comparison/${id}`)
      .then(({ data }) => {
        setMutualCount(data.mutualCount);
        return resolveAndBuild(data.mutuals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, resolveAndBuild]);

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
      <SectionList
        sections={sections}
        keyExtractor={item => item.contactHash}
        renderItem={({ item }) => <ContactCard item={item} />}
        renderSectionHeader={({ section }) => <SectionHeader section={section} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/(app)' as never)} style={styles.backBtnRow}>
              <Text style={styles.backText}>← Home</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {mutualCount} mutual contact{mutualCount !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.subtitle}>
              Organized by how often you both call them
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16 },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  backBtnRow: { marginBottom: 16 },
  backText: { fontSize: 15, color: Colors.primary },
  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  listContent: { paddingBottom: 32 },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  sectionCount: { backgroundColor: Colors.border, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 1 },
  sectionCountText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  sectionSubtitle: { fontSize: 12, color: Colors.textSecondary + 'aa', lineHeight: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, marginHorizontal: 20, marginBottom: 8,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  avatar: { position: 'relative', width: 44, height: 44 },
  avatarText: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary + '25',
    textAlign: 'center', lineHeight: 44,
    fontSize: 18, fontWeight: '700', color: Colors.primary,
  },
  bothDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.success, borderWidth: 2, borderColor: Colors.surface,
  },
  cardBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  callLabel: { fontSize: 12, color: Colors.textSecondary },
  weekBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: Colors.success + '60',
  },
  weekBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.success },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary + '20', borderRadius: 12 },
});
