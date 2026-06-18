import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import type { TransportType } from '../../types';

interface Props {
  transport: TransportType | null;
  onSelectTransport: (t: TransportType) => void;
}

const OPTIONS: { key: TransportType; icon: string; title: string; desc: string; detail: string }[] = [
  { key: 'car', icon: 'car-sport-outline', title: '자차 / 렌트카', desc: '넓은 이동 반경', detail: '하루 4-6곳 방문 가능' },
  { key: 'transit', icon: 'bus-outline', title: '대중교통', desc: '환승 기반 이동', detail: '하루 3-4곳 방문 가능' },
  { key: 'walk', icon: 'walk-outline', title: '도보 여행', desc: '근거리 중심 일정', detail: '하루 2-3곳 방문 가능' },
];

export default function StepTransport({ transport, onSelectTransport }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="car" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>어떻게 이동하시나요?</Text>
        <Text style={styles.subtitle}>이동 방식에 따라 하루 방문 장소 수가 달라져요</Text>
      </View>

      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const selected = transport === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => onSelectTransport(opt.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.modeIconBox, selected && styles.modeIconBoxSelected]}>
                <Ionicons
                  name={opt.icon as keyof typeof Ionicons.glyphMap}
                  size={26}
                  color={selected ? Theme.colors.primaryDark : Theme.colors.textSecondary}
                />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, selected && styles.cardTitleSel]}>{opt.title}</Text>
                <Text style={styles.cardDesc}>{opt.desc}</Text>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={12} color={Theme.colors.textTertiary} />
                  <Text style={styles.detailText}>{opt.detail}</Text>
                </View>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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
  list: { gap: Theme.spacing.md },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, borderWidth: 2, borderColor: Theme.colors.border,
    padding: Theme.spacing.xl, ...Theme.shadow.sm,
  },
  cardSelected: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  modeIconBox: {
    width: 56, height: 56, borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.background,
    alignItems: 'center', justifyContent: 'center', marginRight: Theme.spacing.lg,
  },
  modeIconBoxSelected: { backgroundColor: '#FFF' },
  cardBody: { flex: 1 },
  cardTitle: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary },
  cardTitleSel: { color: Theme.colors.primaryDark },
  cardDesc: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  detailText: { ...Theme.typography.caption, color: Theme.colors.textTertiary },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Theme.colors.border,
    alignItems: 'center', justifyContent: 'center', marginLeft: Theme.spacing.sm,
  },
  radioSelected: { borderColor: Theme.colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Theme.colors.primary },
});
