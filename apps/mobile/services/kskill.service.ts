export type KSkillStatus = "connected" | "demo" | "unavailable";

export interface KSkillWeatherSummary {
  temperature?: string;
  sky?: string;
  precipitation?: string;
  rainProbability?: string;
  humidity?: string;
}

export interface KSkillFineDustSummary {
  station?: string;
  measuredAt?: string;
  pm10?: string;
  pm10Grade?: string;
  pm25?: string;
  pm25Grade?: string;
  overallGrade?: string;
}

export interface KSkillParkingSummary {
  name: string;
  address?: string;
  distance?: string;
}

export interface KSkillTravelInfo {
  destinationLabel: string;
  status: KSkillStatus;
  statusLabel: string;
  sourceLabel: string;
  weather?: KSkillWeatherSummary;
  fineDust?: KSkillFineDustSummary;
  parkingLots: KSkillParkingSummary[];
  updatedAt?: string;
  message?: string;
}

type DestinationApiProfile = {
  label: string;
  lat: number;
  lon: number;
  fineDustRegionHint: string;
};

const KSKILL_BASE_URL =
  (process.env.EXPO_PUBLIC_KSKILL_PROXY_BASE_URL ?? "https://k-skill-proxy.nomadamas.org").replace(/\/$/, "");

const DESTINATION_PROFILES: Record<string, DestinationApiProfile> = {
  서울: { label: "서울", lat: 37.5665, lon: 126.978, fineDustRegionHint: "서울 강남구" },
  제주: { label: "제주", lat: 33.4996, lon: 126.5312, fineDustRegionHint: "제주 제주시" },
  제주도: { label: "제주", lat: 33.4996, lon: 126.5312, fineDustRegionHint: "제주 제주시" },
  부산: { label: "부산", lat: 35.1796, lon: 129.0756, fineDustRegionHint: "부산 연제구" },
  강릉: { label: "강릉", lat: 37.7519, lon: 128.8761, fineDustRegionHint: "강원 강릉시" },
  여수: { label: "여수", lat: 34.7604, lon: 127.6622, fineDustRegionHint: "전남 여수시" },
  경주: { label: "경주", lat: 35.8562, lon: 129.2247, fineDustRegionHint: "경북 경주시" },
  전주: { label: "전주", lat: 35.8242, lon: 127.148, fineDustRegionHint: "전북 전주시" },
};

const DEMO_INFO: KSkillTravelInfo = {
  destinationLabel: "서울",
  status: "demo",
  statusLabel: "데모 데이터 사용 중",
  sourceLabel: "K-skill 공공데이터 연결 대기",
  weather: {
    temperature: "18도",
    sky: "구름많음",
    precipitation: "강수 없음",
    rainProbability: "20%",
    humidity: "55%",
  },
  fineDust: {
    station: "강남구",
    measuredAt: "최근 관측 예시",
    pm10: "43",
    pm10Grade: "보통",
    pm25: "19",
    pm25Grade: "보통",
    overallGrade: "보통",
  },
  parkingLots: [
    { name: "시청 인근 공영주차장", address: "목적지 주변 공영주차장 예시" },
    { name: "관광지 환승 주차장", address: "실서버 연결 시 거리순 표시" },
  ],
  message: "네트워크 또는 공공 API 응답이 불안정하면 시연용 데모 정보로 표시합니다.",
};

function resolveProfile(destination?: string): DestinationApiProfile {
  const normalized = (destination ?? "").trim();
  const matched = Object.entries(DESTINATION_PROFILES).find(([key]) => normalized.includes(key));
  return matched?.[1] ?? DESTINATION_PROFILES.서울;
}

async function getJson<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(`${KSKILL_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`K-skill ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

function skyLabel(code?: string): string | undefined {
  if (code === "1") return "맑음";
  if (code === "3") return "구름많음";
  if (code === "4") return "흐림";
  return undefined;
}

function precipitationLabel(code?: string): string | undefined {
  const labels: Record<string, string> = {
    "0": "강수 없음",
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
    "5": "빗방울",
    "6": "빗방울/눈날림",
    "7": "눈날림",
  };
  return code ? labels[code] : undefined;
}

function parseWeather(raw: unknown): KSkillWeatherSummary | undefined {
  const items = ((raw as {
    response?: { body?: { items?: { item?: Array<{ category?: string; fcstValue?: string }> } } };
  }).response?.body?.items?.item ?? []);

  if (!Array.isArray(items) || items.length === 0) return undefined;

  const byCategory = new Map<string, string>();
  for (const item of items) {
    if (item.category && item.fcstValue && !byCategory.has(item.category)) {
      byCategory.set(item.category, item.fcstValue);
    }
  }

  const temperature = byCategory.get("TMP");
  const pop = byCategory.get("POP");
  const pcp = byCategory.get("PCP");
  const reh = byCategory.get("REH");

  return {
    temperature: temperature ? `${temperature}도` : undefined,
    sky: skyLabel(byCategory.get("SKY")),
    precipitation: pcp && pcp !== "강수없음" ? pcp : precipitationLabel(byCategory.get("PTY")),
    rainProbability: pop ? `${pop}%` : undefined,
    humidity: reh ? `${reh}%` : undefined,
  };
}

function parseFineDust(raw: unknown): KSkillFineDustSummary | undefined {
  const data = raw as {
    station_name?: string;
    measured_at?: string;
    pm10?: { value?: string; grade?: string };
    pm25?: { value?: string; grade?: string };
    khai_grade?: string;
  };

  if (!data.pm10 && !data.pm25 && !data.khai_grade) return undefined;

  return {
    station: data.station_name,
    measuredAt: data.measured_at,
    pm10: data.pm10?.value,
    pm10Grade: data.pm10?.grade,
    pm25: data.pm25?.value,
    pm25Grade: data.pm25?.grade,
    overallGrade: data.khai_grade,
  };
}

function parseParkingLots(raw: unknown): KSkillParkingSummary[] {
  const source = raw as {
    items?: unknown[];
    results?: unknown[];
    data?: unknown[];
    parkingLots?: unknown[];
  };
  const rows = source.items ?? source.results ?? source.data ?? source.parkingLots ?? [];
  if (!Array.isArray(rows)) return [];

  return rows.slice(0, 3).map((row, index) => {
    const item = row as Record<string, unknown>;
    const name =
      item.name ?? item.parkingName ?? item.parking_name ?? item.PRKNM ?? item.title ?? `공영주차장 ${index + 1}`;
    const address = item.address ?? item.addr ?? item.roadAddress ?? item.road_address ?? item.ADDR;
    const distance = item.distance ?? item.distanceMeters ?? item.distance_meters;
    return {
      name: String(name),
      address: typeof address === "string" ? address : undefined,
      distance: typeof distance === "number" || typeof distance === "string" ? String(distance) : undefined,
    };
  });
}

export async function fetchKSkillTravelInfo(destination?: string): Promise<KSkillTravelInfo> {
  const profile = resolveProfile(destination);
  const demoForDestination = { ...DEMO_INFO, destinationLabel: profile.label };

  try {
    const [weatherResult, dustResult, parkingResult] = await Promise.allSettled([
      getJson<unknown>("/v1/korea-weather/forecast", { lat: profile.lat, lon: profile.lon }),
      getJson<unknown>("/v1/fine-dust/report", { regionHint: profile.fineDustRegionHint }),
      getJson<unknown>("/v1/parking-lots/search", {
        latitude: profile.lat,
        longitude: profile.lon,
        limit: 3,
      }),
    ]);

    const weather = weatherResult.status === "fulfilled" ? parseWeather(weatherResult.value) : undefined;
    const fineDust = dustResult.status === "fulfilled" ? parseFineDust(dustResult.value) : undefined;
    const parkingLots =
      parkingResult.status === "fulfilled" ? parseParkingLots(parkingResult.value) : [];

    const hasLiveData = Boolean(weather || fineDust || parkingLots.length > 0);
    if (!hasLiveData) {
      return demoForDestination;
    }

    return {
      destinationLabel: profile.label,
      status: "connected",
      statusLabel: "실서버 연결됨",
      sourceLabel: "K-skill 공공데이터",
      weather,
      fineDust,
      parkingLots: parkingLots.length > 0 ? parkingLots : demoForDestination.parkingLots,
      updatedAt: new Date().toISOString(),
      message:
        parkingResult.status === "rejected"
          ? "주차장 API는 일시적으로 데모 목록을 함께 표시합니다."
          : undefined,
    };
  } catch {
    return demoForDestination;
  }
}
