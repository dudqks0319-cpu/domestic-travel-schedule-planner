import type { Ionicons } from "@expo/vector-icons";

import type { CompanionType, TransportType } from "../types";

export type TravelStyleKey =
  | "sea_cafe_food"
  | "food_focused"
  | "history_walk"
  | "family_easy"
  | "rainy_backup"
  | "walker_transit"
  | "drive_trip"
  | "parents_comfort"
  | "pet_friendly";

export interface TravelStyleOption {
  styleKey: TravelStyleKey;
  title: string;
  shortTitle: string;
  description: string;
  keywordSuffix: string;
  defaultTransport: TransportType;
  defaultCompanion: CompanionType;
  icon: keyof typeof Ionicons.glyphMap;
  tags: string[];
}

export const TRAVEL_STYLE_OPTIONS: readonly TravelStyleOption[] = [
  {
    styleKey: "sea_cafe_food",
    title: "바다+카페+맛집",
    shortTitle: "바다+카페",
    description: "해변, 로컬 카페, 식사 시간을 균형 있게 배치합니다.",
    keywordSuffix: "바다 카페 맛집",
    defaultTransport: "car",
    defaultCompanion: "friends",
    icon: "cafe-outline",
    tags: ["바다", "카페", "맛집"]
  },
  {
    styleKey: "food_focused",
    title: "맛집 집중",
    shortTitle: "맛집 집중",
    description: "점심, 저녁, 카페 시간을 중심으로 동선을 만듭니다.",
    keywordSuffix: "로컬 맛집 카페 시장",
    defaultTransport: "transit",
    defaultCompanion: "friends",
    icon: "restaurant-outline",
    tags: ["맛집", "카페", "시장"]
  },
  {
    styleKey: "history_walk",
    title: "역사 산책",
    shortTitle: "역사 산책",
    description: "문화유산과 걷기 좋은 거리를 무리 없이 묶습니다.",
    keywordSuffix: "역사 산책 문화",
    defaultTransport: "walk",
    defaultCompanion: "solo",
    icon: "footsteps-outline",
    tags: ["역사", "산책", "전시"]
  },
  {
    styleKey: "family_easy",
    title: "아이와 함께",
    shortTitle: "아이와 함께",
    description: "이동 거리를 줄이고 쉬는 시간을 넉넉히 둡니다.",
    keywordSuffix: "가족 아이 실내 체험",
    defaultTransport: "car",
    defaultCompanion: "family_kids",
    icon: "happy-outline",
    tags: ["아이", "실내", "체험"]
  },
  {
    styleKey: "rainy_backup",
    title: "비 오는 날",
    shortTitle: "비 오는 날",
    description: "실내 관광지와 식사/카페 동선을 우선합니다.",
    keywordSuffix: "실내 전시 카페 박물관",
    defaultTransport: "transit",
    defaultCompanion: "couple",
    icon: "rainy-outline",
    tags: ["실내", "전시", "카페"]
  },
  {
    styleKey: "walker_transit",
    title: "뚜벅이 여행",
    shortTitle: "뚜벅이 여행",
    description: "대중교통과 도보 이동에 맞춰 촘촘한 권역을 고릅니다.",
    keywordSuffix: "대중교통 도보 역세권 산책",
    defaultTransport: "transit",
    defaultCompanion: "solo",
    icon: "walk-outline",
    tags: ["대중교통", "도보", "역세권"]
  },
  {
    styleKey: "drive_trip",
    title: "드라이브 여행",
    shortTitle: "드라이브 여행",
    description: "차량 이동을 전제로 넓은 권역과 전망 좋은 코스를 연결합니다.",
    keywordSuffix: "드라이브 전망 자연",
    defaultTransport: "car",
    defaultCompanion: "couple",
    icon: "car-sport-outline",
    tags: ["드라이브", "전망", "자연"]
  },
  {
    styleKey: "parents_comfort",
    title: "부모님과 함께",
    shortTitle: "부모님과 함께",
    description: "이동 밀도와 체류 시간을 낮춰 편안한 일정을 만듭니다.",
    keywordSuffix: "부모님 편안한 맛집 자연",
    defaultTransport: "car",
    defaultCompanion: "parents",
    icon: "accessibility-outline",
    tags: ["편안함", "맛집", "자연"]
  },
  {
    styleKey: "pet_friendly",
    title: "반려동물 동반",
    shortTitle: "반려동물 동반",
    description: "반려동물 동반 가능 장소와 야외 코스를 우선합니다.",
    keywordSuffix: "반려동물 동반 가능 야외 카페",
    defaultTransport: "car",
    defaultCompanion: "friends",
    icon: "paw-outline",
    tags: ["반려동물", "야외", "카페"]
  }
];

export const DEFAULT_TRAVEL_STYLE_KEY: TravelStyleKey = "sea_cafe_food";

export function isTravelStyleKey(value: unknown): value is TravelStyleKey {
  return (
    typeof value === "string" &&
    TRAVEL_STYLE_OPTIONS.some((option) => option.styleKey === value)
  );
}

export function getTravelStyleOption(value: unknown): TravelStyleOption {
  if (isTravelStyleKey(value)) {
    return (
      TRAVEL_STYLE_OPTIONS.find((option) => option.styleKey === value) ??
      TRAVEL_STYLE_OPTIONS[0]
    );
  }

  if (typeof value === "string") {
    return (
      TRAVEL_STYLE_OPTIONS.find(
        (option) => option.title === value || option.shortTitle === value
      ) ?? TRAVEL_STYLE_OPTIONS[0]
    );
  }

  return TRAVEL_STYLE_OPTIONS[0];
}
