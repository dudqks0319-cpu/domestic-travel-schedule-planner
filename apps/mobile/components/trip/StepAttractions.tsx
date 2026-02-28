import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import { tourismApi } from '../../services/api';

interface Props {
  destination: string;
  selectedAttractions: string[];
  onChangeAttractions: (v: string[]) => void;
}

interface Item {
  contentid: string; title: string; addr1: string; firstimage?: string;
}

const CATS = [
  { key: 'all', label: '전체', icon: 'apps-outline' },
  { key: '12', label: '관광지', icon: 'camera-outline' },
  { key: '14', label: '문화시설', icon: 'library-outline' },
  { key: '15', label: '축제', icon: 'ticket-outline' },
  { key: '25', label: '여행코스', icon: 'trail-sign-outline' },
  { key: '28', label: '레포츠', icon: 'bicycle-outline' },
  { key: '38', label: '쇼핑', icon: 'bag-outline' },
];

export default function StepAttractions({ destination, selectedAttractions, onChangeAttractions }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(async (p: number, c?: string, reset = false) => {
    if (!destination) return;
    setLoading(true); setError('');
    try {
      const area = destination.replace(/도$|시$|군$|구$/g, '').trim();
      const ct = c === 'all' ? undefined : c;
      const res = await tourismApi.getAttractions(area, p, ct);
      const arr = (res.data.items ?? []) as Item[];
      setItems((prev) => reset ? arr : [...prev, ...arr]);
      setHasMore(arr.length >= 20);
    } catch { setError('관광지 정보를 불러올 수 없습니다'); }
    finally { setLoading(false); }
  }, [destination]);

  useEffect(() => { setPage(1); setHasMore(true); fetchData(1, cat, true); }, [destination, cat, fetchData]);

  const loadMore = () => {
    if (loading || !hasMore) return;
    const np = page + 1; setPage(np); fetchData(np, cat);
  };

  const toggle = (id: string) => {
    onChangeAttractions(
      selectedAttractions.includes(id)
        ? selectedAttractions.filter((v) => v !== id)
        : [...selectedAttractions, id]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="camera" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>{destination} 관광지</Text>
        <Text style={styles.subtitle}>가보고 싶은 곳을 골라주세요 (복수 선택)</Text>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={CATS}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.filterScroll}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.filterChip, cat === c.key && styles.filterChipActive]}
            onPress={() => setCat(c.key)}
          >
            <Ionicons name={c.icon as any} size={14} color={cat === c.key ? Theme.colors.primary : Theme.colors.textTertiary} />
            <Text style={[styles.filterText, cat === c.key && styles.filterTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        )}
      />

      {error ? (
        <View style={styles.errBox}>
          <Ionicons name="warning-outline" size={16} color={Theme.colors.error} />
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(i) => i.contentid}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingBottom: Theme.spacing.lg }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        style={{ maxHeight: 420 }}
        ListFooterComponent={loading ? <ActivityIndicator color={Theme.colors.primary} style={{ margin: 12 }} /> : null}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>검색 결과가 없어요</Text> : null}
        renderItem={({ item }) => {
          const sel = selectedAttractions.includes(item.contentid);
          return (
            <TouchableOpacity style={[styles.card, sel && styles.cardSel]} onPress={() => toggle(item.contentid)} activeOpacity={0.7}>
              {item.firstimage ? (
                <Image source={{ uri: item.firstimage }} style={styles.cardImg} />
              ) : (
                <View style={[styles.cardImg, styles.cardImgPh]}>
                  <Ionicons name="image-outline" size={28} color={Theme.colors.textTertiary} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{item.addr1}</Text>
              </View>
              {sel && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.countBar}>
        <Ionicons name="checkmark-circle" size={18} color={Theme.colors.primary} />
        <Text style={styles.countText}>{selectedAttractions.length}개 선택됨</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Theme.spacing.xl, flex: 1 },
  hero: { alignItems: 'center', marginBottom: Theme.spacing.lg },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  filterScroll: { gap: 8, marginBottom: Theme.spacing.lg, paddingRight: Theme.spacing.xl },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.full,
    borderWidth: 1, borderColor: Theme.colors.border,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: Theme.colors.primaryLight, borderColor: Theme.colors.primary },
  filterText: { ...Theme.typography.caption, fontWeight: '600', color: Theme.colors.textTertiary },
  filterTextActive: { color: Theme.colors.primary },
  row: { gap: Theme.spacing.md },
  card: {
    flex: 1, backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, borderWidth: 2, borderColor: Theme.colors.border,
    overflow: 'hidden', marginBottom: Theme.spacing.md,
    ...Theme.shadow.sm,
  },
  cardSel: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  cardImg: { width: '100%', height: 110 },
  cardImgPh: { backgroundColor: Theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: Theme.spacing.md },
  cardTitle: { ...Theme.typography.body2, fontWeight: '700', color: Theme.colors.textPrimary },
  cardAddr: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  checkBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Theme.shadow.sm,
  },
  countBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.full, paddingVertical: 10,
  },
  countText: { ...Theme.typography.body2, fontWeight: '700', color: Theme.colors.primary },
  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.colors.secondaryLight, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
  },
  errText: { ...Theme.typography.body2, color: Theme.colors.error },
  emptyText: { ...Theme.typography.body1, color: Theme.colors.textTertiary, textAlign: 'center', marginTop: 40 },
});
