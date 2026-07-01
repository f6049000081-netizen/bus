import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getApiClient } from '@bus/shared';
import Toast from 'react-native-toast-message';
import { Colors, FontSize, Spacing, Radii, Fonts } from '../../src/constants/theme';

interface ComparisonListItem {
  id: string;
  mutualCount: number;
  createdAt: string;
  userAId: string;
  userBId: string;
}

export default function HistoryScreen() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['comparisons'],
    queryFn: async () => {
      const { data } = await getApiClient().get<ComparisonListItem[]>('/api/comparison');
      return data;
    },
  });

  const handleDelete = (id: string) => {
    Alert.alert('Delete Comparison', 'Remove this comparison from your history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setDeleting(id);
        try {
          await getApiClient().delete(`/api/comparison/${id}`);
          queryClient.setQueryData<ComparisonListItem[]>(['comparisons'], prev =>
            prev?.filter(c => c.id !== id) ?? []
          );
          Toast.show({ type: 'success', text1: 'Comparison deleted' });
        } catch {
          Toast.show({ type: 'error', text1: 'Delete failed' });
        } finally {
          setDeleting(null);
        }
      }},
    ]);
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
  if (isError) return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Could not load history.</Text>
      <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Past Comparisons</Text>
      {!data?.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No comparisons yet. Tap Compare to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => router.push({ pathname: '/result/[id]', params: { id: item.id } } as never)}
                activeOpacity={0.8}
              >
                <Text style={styles.count}>{item.mutualCount} mutual contact{item.mutualCount !== 1 ? 's' : ''}</Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.warmIntroBtn}
                  onPress={() => router.push({ pathname: '/warm-intro', params: { anchorId: item.id } } as never)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.warmIntroText}>Intro</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  activeOpacity={0.8}
                >
                  {deleting === item.id
                    ? <ActivityIndicator color={Colors.danger} size="small" />
                    : <Text style={styles.deleteText}>✕</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.xxl },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.heading, fontFamily: Fonts.bold, color: Colors.textPrimary, marginTop: Spacing.xxxl, marginBottom: Spacing.xl },
  list: { gap: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: Radii.card, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', alignItems: 'center' },
  cardMain: { flex: 1 },
  count: { fontSize: FontSize.subheading, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  date: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: Spacing.xs },
  cardActions: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  warmIntroBtn: { backgroundColor: Colors.primary + '25', borderRadius: Radii.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  warmIntroText: { fontSize: FontSize.small, fontFamily: Fonts.semiBold, color: Colors.primary },
  deleteBtn: { padding: Spacing.xs },
  deleteText: { fontSize: FontSize.body, color: Colors.danger },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: FontSize.body, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  errorText: { fontSize: FontSize.body, color: Colors.danger, marginBottom: Spacing.lg },
  retryBtn: { backgroundColor: Colors.primary, borderRadius: Radii.button, padding: Spacing.md, paddingHorizontal: Spacing.xl },
  retryText: { fontSize: FontSize.body, fontFamily: Fonts.semiBold, color: Colors.white },
});
