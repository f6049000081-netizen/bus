import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getApiClient } from '@bus/shared';
import { useAuthStore } from '../../src/stores/authStore';
import { hashAllContacts, HashedContact, requestContactsPermission } from '../../src/services/contacts';

interface MutualItem {
  contactHash: string;
  yourFrequency: string;
  theirFrequency: string;
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
};

const FREQ_COLORS: Record<string, string> = {
  frequent: Colors.success,
  occasional: Colors.warning,
  rare: Colors.textSecondary,
  unknown: Colors.border,
};

function FreqBadge({ label }: { label: string }) {
  const color = FREQ_COLORS[label] ?? FREQ_COLORS.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: color + '30', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { salt } = useAuthStore();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const resolveNames = useCallback(async (mutuals: MutualItem[]) => {
    if (!salt || mutuals.length === 0) return;
    const granted = await requestContactsPermission();
    if (!granted) return;
    const hashed: HashedContact[] = await hashAllContacts(salt);
    const mutualSet = new Set(mutuals.map((m) => m.contactHash));
    const map: Record<string, string> = {};
    for (const h of hashed) {
      if (h.localName && mutualSet.has(h.hash)) {
        map[h.hash] = h.localName;
      }
    }
    setNameMap(map);
  }, [salt]);

  useEffect(() => {
    if (!id) return;
    getApiClient().get<ComparisonResult>(`/api/comparison/${id}`)
      .then(({ data }) => {
        setResult(data);
        return resolveNames(data.mutuals);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, resolveNames]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading results…</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load results.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(app)' as never)} style={styles.backBtn}>
          <Text style={styles.backText}>← Home</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {result.mutualCount === 0
            ? 'No mutual contacts'
            : `${result.mutualCount} mutual contact${result.mutualCount === 1 ? '' : 's'}`}
        </Text>
        <Text style={styles.subtitle}>
          {result.mutualCount === 0
            ? "You don't share any contacts yet."
            : 'These are contacts you both have. Names come from your own address book.'}
        </Text>
      </View>

      {result.mutualCount === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🤷</Text>
          <Text style={styles.emptyText}>
            Neither of you has the other's contacts, or their contacts aren't synced yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={result.mutuals}
          keyExtractor={(item) => item.contactHash}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(nameMap[item.contactHash] ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {nameMap[item.contactHash] ?? 'Unknown Contact'}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <FreqBadge label={item.yourFrequency} />
                <FreqBadge label={item.theirFrequency} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { fontSize: 15, color: Colors.textSecondary, marginTop: 16 },
  errorText: { fontSize: 15, color: Colors.danger },
  header: { padding: 24, paddingTop: 56 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 15, color: Colors.primary },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  list: { padding: 24, gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + '30', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, flex: 1 },
  cardRight: { flexDirection: 'row', gap: 6 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  emptyCard: { margin: 24, backgroundColor: Colors.surface, borderRadius: 16, padding: 32, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Colors.border },
  emptyEmoji: { fontSize: 40 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
});
