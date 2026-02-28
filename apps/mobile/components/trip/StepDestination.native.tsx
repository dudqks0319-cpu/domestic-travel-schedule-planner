import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';

interface Props {
  destination: string;
  onChangeDestination: (v: string) => void;
}

const DESTINATIONS = [
  { name: '제주도', emoji: '🏝️', desc: '자연과 힐링' },
  { name: '부산', emoji: '🌊', desc: '바다와 미식' },
  { name: '서울', emoji: '🏙️', desc: '도심 여행' },
  { name: '강릉', emoji: '☕', desc: '커피와 해변' },
  { name: '여수', emoji: '🌙', desc: '밤바다' },
  { name: '경주', emoji: '🏛️', desc: '역사 탐방' },
];

const MAP_PINS = [
  { name: '서울', left: '53%', top: '22%' },
  { name: '인천', left: '41%', top: '25%' },
  { name: '강릉', left: '72%', top: '28%' },
  { name: '경주', left: '69%', top: '49%' },
  { name: '부산', left: '73%', top: '61%' },
  { name: '여수', left: '54%', top: '62%' },
  { name: '제주도', left: '37%', top: '82%' },
];

const RANDOM_POOL = ['제주도', '부산', '서울', '강릉', '여수', '경주', '전주', '인천', '속초', '포항'];

const ROULETTE_SIZE = 240;
const ROULETTE_RADIUS = 90;

export default function StepDestination({ destination, onChangeDestination }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [randomMsg, setRandomMsg] = useState('');
  const spinVal = useRef(new Animated.Value(0)).current;

  const rotation = spinVal.interpolate({
    inputRange: [0, 8],
    outputRange: ['0deg', '2880deg'],
  });

  const rouletteNodes = useMemo(() =>
    RANDOM_POOL.map((name, i) => {
      const angle = (Math.PI * 2 * i) / RANDOM_POOL.length - Math.PI / 2;
      return {
        name,
        left: ROULETTE_SIZE / 2 + Math.cos(angle) * ROULETTE_RADIUS - 28,
        top: ROULETTE_SIZE / 2 + Math.sin(angle) * ROULETTE_RADIUS - 10,
      };
    }), []);

  const handleRandom = () => {
    const picked = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
    setRandomMsg(`🎯 ${picked}`);
    onChangeDestination(picked);
  };

  const handleSpin = () => {
    if (spinning) return;
    const idx = Math.floor(Math.random() * RANDOM_POOL.length);
    const picked = RANDOM_POOL[idx];
    const rounds = 4 + Math.floor(Math.random() * 3);
    setSpinning(true);
    setRandomMsg('룰렛 돌아가는 중...');
    spinVal.setValue(0);
    Animated.timing(spinVal, {
      toValue: rounds + idx / RANDOM_POOL.length,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setSpinning(false);
      setRandomMsg(`🎰 ${picked}`);
      onChangeDestination(picked);
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Ionicons name="location" size={32} color={Theme.colors.primary} />
        </View>
        <Text style={styles.title}>어디로 떠나볼까요?</Text>
        <Text style={styles.subtitle}>여행지를 검색하거나 아래에서 골라보세요</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Theme.colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="도시나 지역을 입력해주세요"
          placeholderTextColor={Theme.colors.textTertiary}
          value={destination}
          onChangeText={onChangeDestination}
        />
        {destination.length > 0 && (
          <TouchableOpacity onPress={() => onChangeDestination('')}>
            <Ionicons name="close-circle" size={18} color={Theme.colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionTitle}>인기 여행지</Text>
      <View style={styles.chipGrid}>
        {DESTINATIONS.map((d) => {
          const selected = destination.trim() === d.name;
          return (
            <TouchableOpacity
              key={d.name}
              style={[styles.destChip, selected && styles.destChipActive]}
              onPress={() => onChangeDestination(d.name)}
              activeOpacity={0.7}
            >
              <Text style={styles.destEmoji}>{d.emoji}</Text>
              <View>
                <Text style={[styles.destName, selected && styles.destNameActive]}>{d.name}</Text>
                <Text style={styles.destDesc}>{d.desc}</Text>
              </View>
              {selected && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="map-outline" size={18} color={Theme.colors.primary} />
          <Text style={styles.cardTitle}>지도에서 선택</Text>
        </View>
        <Text style={styles.cardDesc}>핀을 눌러 목적지를 선택하세요</Text>
        <View style={styles.mapBox}>
          <View style={styles.mapBody} pointerEvents="none" />
          <View style={styles.mapNorth} pointerEvents="none" />
          <View style={styles.mapEast} pointerEvents="none" />
          <View style={styles.mapSouth} pointerEvents="none" />
          {MAP_PINS.map((pin) => {
            const selected = destination.trim() === pin.name;
            return (
              <TouchableOpacity
                key={pin.name}
                style={[styles.mapPin, { left: pin.left as any, top: pin.top as any }]}
                onPress={() => onChangeDestination(pin.name)}
              >
                <View style={[styles.mapPinDot, selected && styles.mapPinDotActive]}>
                  {selected && <Ionicons name="checkmark" size={10} color="#FFF" />}
                </View>
                <View style={[styles.mapPinLabel, selected && styles.mapPinLabelActive]}>
                  <Text style={[styles.mapPinText, selected && styles.mapPinTextActive]}>
                    {pin.name}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="dice-outline" size={18} color={Theme.colors.secondary} />
          <Text style={styles.cardTitle}>랜덤 목적지</Text>
        </View>
        <Text style={styles.cardDesc}>운에 맡겨볼까요?</Text>

        <View style={styles.randomBtns}>
          <TouchableOpacity style={styles.randomBtn1} onPress={handleRandom}>
            <Ionicons name="shuffle" size={18} color="#A15B00" />
            <Text style={styles.randomBtn1Text}>랜덤 뽑기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.randomBtn2, spinning && { opacity: 0.6 }]}
            onPress={handleSpin}
            disabled={spinning}
          >
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.randomBtn2Text}>
              {spinning ? '돌아가는 중...' : '룰렛 돌리기'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rouletteWrap}>
          <View style={styles.rouletteBoard}>
            {rouletteNodes.map((n) => {
              const sel = destination.trim() === n.name;
              return (
                <View key={n.name} style={[styles.rouletteNode, { left: n.left, top: n.top }]}>
                  <Text style={[styles.rouletteText, sel && styles.rouletteTextSel]}>{n.name}</Text>
                </View>
              );
            })}
            <Animated.View style={[styles.needleWrap, { transform: [{ rotate: rotation }] }]}>
              <View style={styles.needle} />
              <View style={styles.needleTip} />
            </Animated.View>
            <View style={styles.pivot} />
          </View>
        </View>

        {randomMsg ? (
          <View style={styles.resultBadge}>
            <Text style={styles.resultText}>{randomMsg}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Theme.spacing.xl },
  heroSection: { alignItems: 'center', marginBottom: Theme.spacing.xxl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    borderWidth: 2, borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: 10,
    gap: 10, marginBottom: Theme.spacing.xxl,
    ...Theme.shadow.sm,
  },
  searchInput: {
    flex: 1, ...Theme.typography.body1,
    color: Theme.colors.textPrimary, padding: 0,
  },
  sectionTitle: {
    ...Theme.typography.body1, fontWeight: '700',
    color: Theme.colors.textPrimary, marginBottom: Theme.spacing.md,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm, marginBottom: Theme.spacing.xxl },
  destChip: {
    flexDirection: 'row', alignItems: 'center', gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface, borderRadius: Theme.radius.lg,
    borderWidth: 2, borderColor: Theme.colors.border,
    paddingVertical: Theme.spacing.md, paddingHorizontal: Theme.spacing.lg,
    minWidth: '47%',
    ...Theme.shadow.sm,
  },
  destChipActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  destEmoji: { fontSize: 24 },
  destName: { ...Theme.typography.body2, fontWeight: '700', color: Theme.colors.textPrimary },
  destNameActive: { color: Theme.colors.primary },
  destDesc: { ...Theme.typography.caption, color: Theme.colors.textTertiary },
  checkMark: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
    ...Theme.shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.textPrimary },
  cardDesc: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.lg },
  mapBox: {
    position: 'relative', height: 280, borderRadius: Theme.radius.lg,
    backgroundColor: '#F0F7FF', borderWidth: 1, borderColor: '#D5E7FF',
    overflow: 'hidden',
  },
  mapBody: {
    position: 'absolute', left: '50%', top: 26, width: 104, height: 208,
    marginLeft: -52, borderRadius: 52, backgroundColor: '#E0EDFF', borderWidth: 1, borderColor: '#CFE3FA',
  },
  mapNorth: {
    position: 'absolute', left: '50%', top: 6, width: 78, height: 44,
    marginLeft: -62, borderRadius: 24, backgroundColor: '#E0EDFF', borderWidth: 1, borderColor: '#CFE3FA',
  },
  mapEast: {
    position: 'absolute', left: '50%', top: 74, width: 34, height: 110,
    marginLeft: 22, borderRadius: 18, backgroundColor: '#E0EDFF', borderWidth: 1, borderColor: '#CFE3FA',
  },
  mapSouth: {
    position: 'absolute', left: '50%', top: 166, width: 44, height: 96,
    marginLeft: -66, borderRadius: 20, backgroundColor: '#E0EDFF', borderWidth: 1, borderColor: '#CFE3FA',
  },
  mapPin: {
    position: 'absolute', width: 78, marginLeft: -39, marginTop: -10, alignItems: 'center',
  },
  mapPinDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Theme.colors.primary, borderWidth: 2, borderColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    ...Theme.shadow.sm,
  },
  mapPinDotActive: { width: 20, height: 20, borderRadius: 10, backgroundColor: Theme.colors.primaryDark },
  mapPinLabel: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Theme.radius.full,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D5E7FF',
    ...Theme.shadow.sm,
  },
  mapPinLabelActive: { backgroundColor: Theme.colors.primaryLight, borderColor: Theme.colors.primary },
  mapPinText: { ...Theme.typography.caption, fontWeight: '700', color: Theme.colors.textPrimary },
  mapPinTextActive: { color: Theme.colors.primaryDark },
  randomBtns: { flexDirection: 'row', gap: Theme.spacing.md, marginBottom: Theme.spacing.lg },
  randomBtn1: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFF5E8', borderRadius: Theme.radius.md, paddingVertical: 14,
  },
  randomBtn1Text: { ...Theme.typography.buttonSmall, color: '#A15B00' },
  randomBtn2: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Theme.colors.primary, borderRadius: Theme.radius.md, paddingVertical: 14,
  },
  randomBtn2Text: { ...Theme.typography.buttonSmall, color: '#FFF' },
  rouletteWrap: { alignItems: 'center', marginBottom: Theme.spacing.md },
  rouletteBoard: {
    width: ROULETTE_SIZE, height: ROULETTE_SIZE, borderRadius: ROULETTE_SIZE / 2,
    borderWidth: 4, borderColor: '#D5E7FF', backgroundColor: '#F5FAFF',
    position: 'relative',
  },
  rouletteNode: { position: 'absolute', width: 56, alignItems: 'center' },
  rouletteText: { ...Theme.typography.caption, fontWeight: '700', color: Theme.colors.textSecondary },
  rouletteTextSel: { color: Theme.colors.primaryDark },
  needleWrap: {
    position: 'absolute', left: ROULETTE_SIZE / 2, top: ROULETTE_SIZE / 2,
    width: 0, height: 0,
  },
  needle: {
    position: 'absolute', left: -1.5, top: -72, width: 3, height: 72,
    borderRadius: 999, backgroundColor: Theme.colors.textPrimary,
  },
  needleTip: {
    position: 'absolute', left: -7, top: -82, width: 14, height: 14,
    borderRadius: 7, backgroundColor: Theme.colors.secondary,
  },
  pivot: {
    position: 'absolute', left: ROULETTE_SIZE / 2 - 12, top: ROULETTE_SIZE / 2 - 12,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Theme.colors.textPrimary, borderWidth: 3, borderColor: '#FFF',
  },
  resultBadge: {
    alignSelf: 'center', backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.full, paddingHorizontal: 20, paddingVertical: 8,
  },
  resultText: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.primaryDark },
});
