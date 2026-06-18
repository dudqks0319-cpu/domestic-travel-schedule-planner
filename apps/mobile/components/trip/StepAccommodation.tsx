import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import BottomSheet from '../common/BottomSheet';
import { tourismApi } from '../../services/api';

export type AccommodationType = 'hotel' | 'resort' | 'pension' | 'guesthouse' | 'pool_villa';

interface Props {
  destination: string;
  accommodationType: AccommodationType | null;
  onSelectAccommodation: (t: AccommodationType) => void;
}

interface StayItem {
  contentid: string; title: string; addr1: string;
  firstimage?: string; tel?: string;
}

const OPTIONS: { key: AccommodationType; icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  { key: 'hotel', icon: 'business-outline', title: '호텔', desc: '접근성 중심' },
  { key: 'resort', icon: 'leaf-outline', title: '리조트', desc: '휴양형' },
  { key: 'pension', icon: 'home-outline', title: '펜션', desc: '단독/프라이빗' },
  { key: 'guesthouse', icon: 'bed-outline', title: '게스트하우스', desc: '가성비형' },
  { key: 'pool_villa', icon: 'sparkles-outline', title: '풀빌라', desc: '프리미엄' },
];

export default function StepAccommodation({ destination, accommodationType, onSelectAccommodation }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stays, setStays] = useState<StayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetch_ = useCallback(async () => {
    if (!destination) return;
    setLoading(true); setError('');
    try {
      const area = destination.replace(/도$|시$|군$|구$/g, '').trim();
      const res = await tourismApi.getAttractions(area, 1, '32');
      setStays((res.data.items ?? []) as StayItem[]);
    } catch { setError('숙소 정보를 불러올 수 없습니다'); }
    finally { setLoading(false); }
  }, [destination]);

  useEffect(() => { fetch_(); }, [destination, fetch_]);

  const filtered = useMemo(() => {
    if (!accommodationType) return stays;
    const kw: Record<AccommodationType, string[]> = {
      hotel: ['호텔', 'hotel'], resort: ['리조트', 'resort'],
      pension: ['펜션', 'pension'], guesthouse: ['게스트하우스', '민박'],
      pool_villa: ['풀빌라', '풀 빌라', 'villa'],
    };
    const f = stays.filter((s) => kw[accommodationType].some((k) => s.title.toLowerCase().includes(k)));
    return f.length > 0 ? f : stays;
  }, [accommodationType, stays]);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="bed" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>어떤 숙소를 선호하세요?</Text>
        <Text style={styles.subtitle}>숙소 타입에 따라 체크인 시간과 동선이 달라져요</Text>
      </View>

      <View style={styles.grid}>
        {OPTIONS.map((opt) => {
          const sel = accommodationType === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.card, sel && styles.cardSel]}
              onPress={() => onSelectAccommodation(opt.key)}
              activeOpacity={0.7}
            >
              {sel && (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
              <View style={[styles.stayTypeIcon, sel && styles.stayTypeIconSel]}>
                <Ionicons
                  name={opt.icon}
                  size={26}
                  color={sel ? Theme.colors.primaryDark : Theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.cardTitle, sel && styles.cardTitleSel]}>{opt.title}</Text>
              <Text style={styles.cardDesc}>{opt.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={styles.sheetBtn}
        onPress={() => setSheetOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="search-outline" size={18} color={Theme.colors.primary} />
        <Text style={styles.sheetBtnText}>추천 숙소 보기 ({filtered.length}곳)</Text>
      </TouchableOpacity>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={`${destination} 숙소`}>
        {error ? <Text style={styles.errText}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={Theme.colors.primary} style={{ marginVertical: 20 }} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.contentid}
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => (
              <View style={styles.stayRow}>
                {item.firstimage ? (
                  <Image source={{ uri: item.firstimage }} style={styles.stayImg} />
                ) : (
                  <View style={[styles.stayImg, styles.stayImgPh]}>
                    <Ionicons name="bed-outline" size={22} color={Theme.colors.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.stayName} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.stayAddr} numberOfLines={1}>{item.addr1}</Text>
                  {item.tel && <Text style={styles.stayTel}>{item.tel}</Text>}
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>숙소 정보가 없습니다</Text>}
          />
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Theme.spacing.xl },
  hero: { alignItems: 'center', marginBottom: Theme.spacing.xxl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md },
  card: {
    width: '47%', backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, borderWidth: 2, borderColor: Theme.colors.border,
    padding: Theme.spacing.xl, alignItems: 'center',
    ...Theme.shadow.sm,
  },
  cardSel: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  check: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stayTypeIcon: {
    width: 54,
    height: 54,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  stayTypeIconSel: { backgroundColor: Theme.colors.surface },
  cardTitle: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary },
  cardTitleSel: { color: Theme.colors.primaryDark },
  cardDesc: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 4 },
  sheetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    borderWidth: 2, borderColor: Theme.colors.primary,
    paddingVertical: 14, marginTop: Theme.spacing.xl,
    ...Theme.shadow.sm,
  },
  sheetBtnText: { ...Theme.typography.button, color: Theme.colors.primary },
  stayRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.md,
    padding: Theme.spacing.md, marginBottom: Theme.spacing.sm,
    borderWidth: 1, borderColor: Theme.colors.borderLight,
  },
  stayImg: { width: 60, height: 60, borderRadius: Theme.radius.sm, marginRight: Theme.spacing.md },
  stayImgPh: { backgroundColor: Theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  stayName: { ...Theme.typography.body2, fontWeight: '700', color: Theme.colors.textPrimary },
  stayAddr: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 2 },
  stayTel: { ...Theme.typography.caption, color: Theme.colors.info, marginTop: 2 },
  errText: { ...Theme.typography.body2, color: Theme.colors.error, textAlign: 'center', marginBottom: 12 },
  emptyText: { ...Theme.typography.body2, color: Theme.colors.textTertiary, textAlign: 'center', marginTop: 20 },
});
