import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../../constants/Theme';

interface Props {
  destination: string;
  onChangeDestination: (v: string) => void;
}

interface DestinationOption {
  name: string;
  emoji: string;
  desc: string;
  lat: number;
  lng: number;
}

interface KakaoLatLng {
  new (lat: number, lng: number): unknown;
}

interface KakaoMapsApi {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => {
    setCenter(center: unknown): void;
    setLevel(level: number): void;
  };
  Marker: new (options: Record<string, unknown>) => unknown;
  InfoWindow: new (options: Record<string, unknown>) => { open(map: unknown, marker: unknown): void };
  LatLng: KakaoLatLng;
  event: {
    addListener(target: unknown, type: string, handler: () => void): void;
  };
  load(callback: () => void): void;
}

interface KakaoGlobal {
  maps: KakaoMapsApi;
}

type KakaoMapStatus = 'idle' | 'loading' | 'ready' | 'error' | 'no-key';

const DESTINATIONS: DestinationOption[] = [
  { name: '제주도', emoji: '🏝️', desc: '자연과 힐링', lat: 33.4996, lng: 126.5312 },
  { name: '부산', emoji: '🌊', desc: '바다와 미식', lat: 35.1796, lng: 129.0756 },
  { name: '서울', emoji: '🏙️', desc: '도심 여행', lat: 37.5665, lng: 126.978 },
  { name: '강릉', emoji: '☕', desc: '커피와 해변', lat: 37.7519, lng: 128.8761 },
  { name: '여수', emoji: '🌙', desc: '밤바다', lat: 34.7604, lng: 127.6622 },
  { name: '경주', emoji: '🏛️', desc: '역사 탐방', lat: 35.8562, lng: 129.2247 },
];

const RANDOM_POOL = ['제주도', '부산', '서울', '강릉', '여수', '경주', '전주', '인천', '속초', '포항'];

const ROULETTE_SIZE = 240;
const ROULETTE_RADIUS = 90;
const KOREA_CENTER = { lat: 36.35, lng: 127.9 };
const KAKAO_SCRIPT_ID = 'tripmate-kakao-map-sdk-step-destination';
let kakaoMapSdkPromise: Promise<KakaoGlobal> | null = null;

function readKakaoMapWebKey(): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const candidate = maybeProcess?.env?.EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const trimmed = candidate?.trim();
  return trimmed ? trimmed : undefined;
}

function loadKakaoMapSdk(appKey: string): Promise<KakaoGlobal> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Kakao map is only available on web.'));
  }

  const browserWindow = window as Window & { kakao?: KakaoGlobal };
  if (browserWindow.kakao?.maps) {
    return new Promise((resolve) => {
      browserWindow.kakao?.maps.load(() => resolve(browserWindow.kakao as KakaoGlobal));
    });
  }

  if (kakaoMapSdkPromise) {
    return kakaoMapSdkPromise;
  }

  kakaoMapSdkPromise = new Promise((resolve, reject) => {
    const onKakaoReady = () => {
      const currentWindow = window as Window & { kakao?: KakaoGlobal };
      if (!currentWindow.kakao?.maps) {
        kakaoMapSdkPromise = null;
        reject(new Error('Kakao Maps SDK failed to initialize.'));
        return;
      }
      currentWindow.kakao.maps.load(() => resolve(currentWindow.kakao as KakaoGlobal));
    };

    const existing = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', onKakaoReady, { once: true });
      existing.addEventListener(
        'error',
        () => {
          kakaoMapSdkPromise = null;
          reject(new Error('Failed to load Kakao Maps SDK script.'));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = KAKAO_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.onload = onKakaoReady;
    script.onerror = () => {
      kakaoMapSdkPromise = null;
      reject(new Error('Failed to load Kakao Maps SDK script.'));
    };
    document.head.appendChild(script);
  });

  return kakaoMapSdkPromise;
}

export default function StepDestination({ destination, onChangeDestination }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [randomMsg, setRandomMsg] = useState('');
  const spinVal = useRef(new Animated.Value(0)).current;
  const mapContainerId = useMemo(() => `tripmate-step-dest-map-${Math.random().toString(36).slice(2)}`, []);

  const kakaoMapKey = useMemo(() => readKakaoMapWebKey(), []);
  const [kakaoStatus, setKakaoStatus] = useState<KakaoMapStatus>(kakaoMapKey ? 'idle' : 'no-key');
  const [kakaoError, setKakaoError] = useState<string | null>(null);

  const rotation = spinVal.interpolate({
    inputRange: [0, 8],
    outputRange: ['0deg', '2880deg'],
  });

  const rouletteNodes = useMemo(
    () =>
      RANDOM_POOL.map((name, i) => {
        const angle = (Math.PI * 2 * i) / RANDOM_POOL.length - Math.PI / 2;
        return {
          name,
          left: ROULETTE_SIZE / 2 + Math.cos(angle) * ROULETTE_RADIUS - 28,
          top: ROULETTE_SIZE / 2 + Math.sin(angle) * ROULETTE_RADIUS - 10,
        };
      }),
    []
  );

  useEffect(() => {
    if (!kakaoMapKey) {
      setKakaoStatus('no-key');
      return;
    }

    let cancelled = false;
    setKakaoStatus('loading');
    setKakaoError(null);

    void loadKakaoMapSdk(kakaoMapKey)
      .then((kakao) => {
        if (cancelled) return;

        const mapContainer = document.getElementById(mapContainerId) as HTMLElement | null;
        if (!mapContainer) {
          throw new Error('Map container is not ready.');
        }

        mapContainer.innerHTML = '';

        const selected = DESTINATIONS.find((d) => d.name === destination);
        const center = selected ?? KOREA_CENTER;
        const map = new kakao.maps.Map(mapContainer, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: selected ? 9 : 13,
        });

        DESTINATIONS.forEach((item) => {
          const latLng = new kakao.maps.LatLng(item.lat, item.lng);
          const marker = new kakao.maps.Marker({
            position: latLng,
            map,
            title: item.name,
          });

          const info = new kakao.maps.InfoWindow({
            content: `<div style="padding:6px 8px;font-size:12px;font-weight:700;">${item.name}</div>`,
          });

          kakao.maps.event.addListener(marker, 'click', () => {
            onChangeDestination(item.name);
            map.setCenter(latLng);
            map.setLevel(9);
            info.open(map, marker);
          });

          if (destination === item.name) {
            info.open(map, marker);
          }
        });

        setKakaoStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setKakaoStatus('error');
        setKakaoError(error instanceof Error ? error.message : 'Kakao map render failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [destination, kakaoMapKey, mapContainerId, onChangeDestination]);

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
        <Text style={styles.subtitle}>여행지를 검색하거나 지도에서 선택하세요</Text>
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
          <Text style={styles.cardTitle}>카카오 지도에서 선택</Text>
        </View>
        <Text style={styles.cardDesc}>마커를 누르면 목적지가 자동 선택됩니다</Text>

        <View nativeID={mapContainerId} style={styles.kakaoMap} />

        {kakaoStatus !== 'ready' ? (
          <View style={styles.noticeCard}>
            {kakaoStatus === 'loading' ? (
              <>
                <ActivityIndicator size="small" color={Theme.colors.primary} />
                <Text style={styles.noticeText}>카카오 지도를 불러오는 중...</Text>
              </>
            ) : kakaoStatus === 'no-key' ? (
              <Text style={styles.noticeText}>`EXPO_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 설정해주세요.</Text>
            ) : (
              <View>
                <Text style={styles.noticeTitle}>카카오 지도 로드 실패</Text>
                <Text style={styles.noticeText}>원인: {kakaoError ?? '알 수 없는 오류'}</Text>
                <Text style={styles.noticeText}>카카오 콘솔 Web 도메인에 `localhost:8081`을 등록하세요.</Text>
              </View>
            )}
          </View>
        ) : null}
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
            <Text style={styles.randomBtn2Text}>{spinning ? '돌아가는 중...' : '룰렛 돌리기'}</Text>
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  title: { ...Theme.typography.h2, color: Theme.colors.textPrimary },
  subtitle: { ...Theme.typography.body2, color: Theme.colors.textSecondary, marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: 10,
    gap: 10,
    marginBottom: Theme.spacing.xxl,
    ...Theme.shadow.sm,
  },
  searchInput: {
    flex: 1,
    ...Theme.typography.body1,
    color: Theme.colors.textPrimary,
    padding: 0,
  },
  sectionTitle: {
    ...Theme.typography.body1,
    fontWeight: '700',
    color: Theme.colors.textPrimary,
    marginBottom: Theme.spacing.md,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.sm, marginBottom: Theme.spacing.xxl },
  destChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.lg,
    borderWidth: 2,
    borderColor: Theme.colors.border,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    minWidth: '47%',
    ...Theme.shadow.sm,
  },
  destChipActive: { borderColor: Theme.colors.primary, backgroundColor: Theme.colors.primaryLight },
  destEmoji: { fontSize: 24 },
  destName: { ...Theme.typography.body2, fontWeight: '700', color: Theme.colors.textPrimary },
  destNameActive: { color: Theme.colors.primary },
  destDesc: { ...Theme.typography.caption, color: Theme.colors.textTertiary },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  kakaoMap: {
    height: 300,
    borderRadius: Theme.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Theme.colors.borderLight,
    backgroundColor: Theme.colors.background,
  },
  noticeCard: {
    marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.md,
    backgroundColor: Theme.colors.primaryLight,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: { ...Theme.typography.body2, color: Theme.colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  noticeText: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
  randomBtns: { flexDirection: 'row', gap: Theme.spacing.md, marginBottom: Theme.spacing.lg },
  randomBtn1: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF5E8',
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
  },
  randomBtn1Text: { ...Theme.typography.buttonSmall, color: '#A15B00' },
  randomBtn2: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Theme.colors.primary,
    borderRadius: Theme.radius.md,
    paddingVertical: 14,
  },
  randomBtn2Text: { ...Theme.typography.buttonSmall, color: '#FFF' },
  rouletteWrap: { alignItems: 'center', marginBottom: Theme.spacing.md },
  rouletteBoard: {
    width: ROULETTE_SIZE,
    height: ROULETTE_SIZE,
    borderRadius: ROULETTE_SIZE / 2,
    borderWidth: 4,
    borderColor: '#D5E7FF',
    backgroundColor: '#F5FAFF',
    position: 'relative',
  },
  rouletteNode: { position: 'absolute', width: 56, alignItems: 'center' },
  rouletteText: { ...Theme.typography.caption, fontWeight: '700', color: Theme.colors.textSecondary },
  rouletteTextSel: { color: Theme.colors.primaryDark },
  needleWrap: {
    position: 'absolute',
    left: ROULETTE_SIZE / 2,
    top: ROULETTE_SIZE / 2,
    width: 0,
    height: 0,
  },
  needle: {
    position: 'absolute',
    left: -1.5,
    top: -72,
    width: 3,
    height: 72,
    borderRadius: 999,
    backgroundColor: Theme.colors.textPrimary,
  },
  needleTip: {
    position: 'absolute',
    left: -7,
    top: -82,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Theme.colors.secondary,
  },
  pivot: {
    position: 'absolute',
    left: ROULETTE_SIZE / 2 - 12,
    top: ROULETTE_SIZE / 2 - 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.textPrimary,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  resultBadge: {
    alignSelf: 'center',
    backgroundColor: Theme.colors.primaryLight,
    borderRadius: Theme.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultText: { ...Theme.typography.body1, fontWeight: '700', color: Theme.colors.primaryDark },
});
