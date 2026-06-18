import type { TravelStyleKey } from "@tripmate/planner";

export type TravelStyleIconName =
  | "cafe-outline"
  | "restaurant-outline"
  | "library-outline"
  | "happy-outline"
  | "rainy-outline"
  | "walk-outline"
  | "car-outline"
  | "people-outline"
  | "paw-outline";

export interface TravelStyleOption {
  key: TravelStyleKey;
  label: string;
  description: string;
  iconName: TravelStyleIconName;
  tintColor: string;
}

export const DEFAULT_TRAVEL_STYLE_KEY: TravelStyleKey = "sea_cafe_food";

export const TRAVEL_STYLE_OPTIONS = [
  {
    key: "sea_cafe_food",
    label: "바다+카페+맛집",
    description: "해안 산책과 카페, 로컬 맛집을 균형 있게",
    iconName: "cafe-outline",
    tintColor: "#DDEEFF"
  },
  {
    key: "food_focused",
    label: "맛집 집중",
    description: "식사와 카페 비중을 높인 코스",
    iconName: "restaurant-outline",
    tintColor: "#FFE4D6"
  },
  {
    key: "history_walk",
    label: "역사 산책",
    description: "문화유산과 걷기 좋은 동선을 우선",
    iconName: "library-outline",
    tintColor: "#EFE6D8"
  },
  {
    key: "with_kids",
    label: "아이와 함께",
    description: "이동 밀도를 낮추고 체험형 장소를 우선",
    iconName: "happy-outline",
    tintColor: "#E2F6E9"
  },
  {
    key: "rainy_day",
    label: "비 오는 날",
    description: "실내 전시, 쇼핑, 카페 중심",
    iconName: "rainy-outline",
    tintColor: "#E3ECFF"
  },
  {
    key: "walking_trip",
    label: "뚜벅이 여행",
    description: "대중교통과 도보로 연결되는 코스",
    iconName: "walk-outline",
    tintColor: "#E9F7F5"
  },
  {
    key: "drive_trip",
    label: "드라이브 여행",
    description: "권역 간 이동과 전망 좋은 코스",
    iconName: "car-outline",
    tintColor: "#E7F0FF"
  },
  {
    key: "with_parents",
    label: "부모님과 함께",
    description: "편안한 이동과 여유 있는 체류 시간",
    iconName: "people-outline",
    tintColor: "#F4E9FF"
  },
  {
    key: "pet_friendly",
    label: "반려동물 동반",
    description: "동반 가능 장소와 산책지를 우선",
    iconName: "paw-outline",
    tintColor: "#FFF1D7"
  }
] as const satisfies readonly TravelStyleOption[];

export function isTravelStyleKey(value: unknown): value is TravelStyleKey {
  return typeof value === "string" && TRAVEL_STYLE_OPTIONS.some((option) => option.key === value);
}

export function resolveTravelStyleKey(value: string | string[] | undefined): TravelStyleKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isTravelStyleKey(candidate) ? candidate : DEFAULT_TRAVEL_STYLE_KEY;
}

export function getTravelStyleOption(styleKey: TravelStyleKey): TravelStyleOption {
  return (
    TRAVEL_STYLE_OPTIONS.find((option) => option.key === styleKey) ??
    TRAVEL_STYLE_OPTIONS[0]
  );
}
