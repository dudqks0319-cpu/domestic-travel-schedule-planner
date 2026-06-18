import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';
import type { CompanionType } from '../../types';

interface Props {
  companion: CompanionType | null;
  onSelectCompanion: (c: CompanionType) => void;
}

const OPTIONS: { key: CompanionType; icon: string; title: string; desc: string; color: string }[] = [
  { key: 'solo', icon: 'person-outline', title: '혼자', desc: '나만의 자유로운 여행', color: '#4A90E2' },
  { key: 'friends', icon: 'people-outline', title: '친구와', desc: '함께 즐기는 추억 여행', color: '#10B981' },
  { key: 'couple', icon: 'heart-outline', title: '커플', desc: '로맨틱 데이트 코스', color: '#FF6B9D' },
  { key: 'family_kids', icon: 'happy-outline', title: '가족+아이', desc: '키즈 친화 장소 우선', color: '#F59E0B' },
  { key: 'family_no_kids', icon: 'home-outline', title: '가족', desc: '여유로운 힐링 여행', color: '#7ED321' },
  { key: 'parents', icon: 'accessibility-outline', title: '부모님과', desc: '편안한 동선 중심', color: '#0D9488' },
];

export default function StepCompanion({ companion, onSelectCompanion }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="people" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>누구와 함께 가나요?</Text>
        <Text style={styles.subtitle}>동행자에 맞춰 장소와 동선을 최적화해요</Text>
      </View>

      <View style={styles.grid}>
        {OPTIONS.map((opt) => {
          const selected = companion === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.card,
                selected && { borderColor: opt.color, backgroundColor: `${opt.color}10` },
              ]}
              onPress={() => onSelectCompanion(opt.key)}
              activeOpacity={0.7}
            >
              {selected && (
                <View style={[styles.check, { backgroundColor: opt.color }]}> 
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
              <View style={[styles.optionIcon, selected && { backgroundColor: `${opt.color}16` }]}>
                <Ionicons
                  name={opt.icon as keyof typeof Ionicons.glyphMap}
                  size={28}
                  color={selected ? opt.color : Theme.colors.textSecondary}
                />
              </View>
              <Text style={[styles.cardTitle, selected && { color: opt.color }]}>{opt.title}</Text>
              <Text style={styles.cardDesc}>{opt.desc}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md },
  card: {
    width: '47%', backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg, borderWidth: 2, borderColor: Theme.colors.border,
    padding: Theme.spacing.xl, alignItems: 'center',
    ...Theme.shadow.sm,
  },
  check: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.sm,
  },
  cardTitle: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary, textAlign: 'center' },
  cardDesc: { ...Theme.typography.caption, color: Theme.colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
