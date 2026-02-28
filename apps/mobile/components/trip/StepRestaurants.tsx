import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import { restaurantApi } from '../../services/api';

interface Props {
  destination: string;
  selectedRestaurants: string[];
  onChangeRestaurants: (v: string[]) => void;
  onComplete: () => void;
  loading?: boolean;
}

interface Item {
  title: string; category: string;
  address: string; roadAddress: string; telephone: string;
}

const CATS = [
  { key: '맛집', label: '전체', icon: 'restaurant-outline' },
  { key: '한식', label: '한식', icon: 'flame-outline' },
  { key: '해산물', label: '해산물', icon: 'fish-outline' },
  { key: '고기', label: '고기', icon: 'nutrition-outline' },
  { key: '카페', label: '카페', icon: 'cafe-outline' },
  { key: '디저트', label: '디저트', icon: 'ice-cream-outline' },
  { key: '분식', label: '분식', icon: 'fast-food-outline' },
];

export default function StepRestaurants({ destination, selectedRestaurants, onChangeRestaurants, onComplete, loading: saving = false }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('맛집');

  const fetch_ = useCallback(async (c: string) => {
    if (!destination) return;
    setFetching(true); setError('');
    try {
      const q = c === '맛집' ? `${destination} 맛집` : `${destination} ${c}`;
      const res = await restaurantApi.search(q, 20);
      setItems((res.data.items ?? []) as Item[]);
    } catch { setError('맛집 정보를 불러올 수 없습니다'); }
    finally { setFetching(false); }
  }, [destination]);

  useEffect(() => { fetch_(cat); }, [destination, cat, fetch_]);

  const toggle = (title: string) => {
    onChangeRestaurants(
      selectedRestaurants.includes(title)
        ? selectedRestaurants.filter((v) => v !== title)
        : [...selectedRestaurants, title]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="restaurant" size={32} color="#FF6B6B" />
        </View>
        <Text style={styles.title}>{destination} 맛집</Text>
        <Text style={styles.subtitle}>먹고 싶은 곳을 골라주세요</Text>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={CATS} keyExtractor={(i) => i.key}
        contentContainerStyle={styles.filterScroll}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            style={[styles.filterChip, cat === c.key && styles.filterChipActive]}
            onPress={() => setCat(c.key)}
          >
            <Ionicons name={c.icon as any} size={14} color={cat === c.key ? '#A15B00' : Theme.colors.textTertiary} />
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
        keyExtractor={(i, idx) => `${i.title}_${idx}`}
        style={{ maxHeight: 360 }}
        contentContainerStyle={{ paddingBottom: Theme.spacing.md }}
        ListFooterComponent={fetching ? <ActivityIndicator color={Theme.colors.primary} style={{ margin: 12 }} /> : null}
        ListEmptyComponent={!fetching ? <Text style={styles.emptyText}>검색 결과가 없어요</Text> : null}
        renderItem={({ item }) => {
          const sel = selectedRestaurants.includes(item.title);
          return (
            <TouchableOpacity style={[styles.card, sel && styles.cardSel]} onPress={() => toggle(item.title)} activeOpacity={0.7}>
              <View style={[styles.cardIcon, sel && styles.cardIconSel]}>
                <Text style={{ fontSize: 22 }}>🍽️</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.catBadge}>
                  <Text style={styles.catBadgeText}>{item.category.split('>').pop()?.trim() ?? '음식점'}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{item.roadAddress || item.address}</Text>
                {item.telephone ? (
                  <View style={styles.telRow}>
                    <Ionicons name="call-outline" size={11} color={Theme.colors.textTertiary} />
                    <Text style={styles.telText}>{item.telephone}</Text>
                  </View>
                ) : null}
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
        <Ionicons name="checkmark-circle" size={18} color="#FF6B6B" />
        <Text style={styles.countText}>{selectedRestaurants.length}개 선택됨</Text>
      </View>

      <TouchableOpacity
        style={[styles.completeBtn, saving && { opacity: 0.7 }]}
        onPress={onComplete}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="sparkles" size={20} color="#FFF" />
            <Text style={styles.completeBtnText}>AI 일정 생성하기</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Theme.spacing.xl, flex: 1, paddingBottom: Theme.spacing.xxxl },
  hero: { alignItems: 'center', marginBottom: Theme.spacing.lg },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFE8E8',
    alignItems: 'center', justifyContent: 'center', marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  filterScroll: { gap: 8, marginBottom: Theme.spacing.lg },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.full,
    borderWidth: 1, borderColor: Theme.colors.border,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: '#FFF5E8', borderColor: '#F59E0B' },
  filterText: { ...Theme.typography.caption, fontWeight: '600', color: Theme.colors.textTertiary },
  filterTextActive: { color: '#A15B00' },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, borderWidth: 2, borderColor: Theme.colors.border,
    padding: Theme.spacing.lg, marginBottom: Theme.spacing.sm,
    ...Theme.shadow.sm,
  },
  cardSel: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  cardIcon: {
    width: 48, height: 48, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.background,
    alignItems: 'center', justifyContent: 'center', marginRight: Theme.spacing.md,
  },
  cardIconSel: { backgroundColor: '#FFF' },
  cardBody: { flex: 1 },
  catBadge: {
    backgroundColor: Theme.colors.background, borderRadius: Theme.radius.sm,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4,
  },
  catBadgeText: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
  cardTitle: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary },
  cardAddr: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  telRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  telText: { ...Theme.typography.caption, color: Theme.colors.textTertiary },
  checkBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginLeft: Theme.spacing.sm,
  },
  countBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Theme.spacing.md,
    backgroundColor: '#FFE8E8', borderRadius: Theme.radius.full, paddingVertical: 10,
  },
  countText: { ...Theme.typography.body2, fontWeight: '700', color: '#FF6B6B' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.lg, paddingVertical: 18, marginTop: Theme.spacing.xl,
    ...Theme.shadow.md,
  },
  completeBtnText: { ...Theme.typography.button, color: '#FFF', fontSize: 18 },
  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Theme.colors.secondaryLight, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.md,
  },
  errText: { ...Theme.typography.body2, color: Theme.colors.error },
  emptyText: { ...Theme.typography.body1, color: Theme.colors.textTertiary, textAlign: 'center', marginTop: 40 },
});
