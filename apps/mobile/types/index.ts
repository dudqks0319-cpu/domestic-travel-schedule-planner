import type {
  NormalizedPlace,
  NormalizedRoute,
  TripPlanInput,
  TripPlanResult,
  TravelStyleKey
} from "@tripmate/planner";

export type {
  NormalizedPlace,
  NormalizedRoute,
  TripPlanInput,
  TripPlanResult,
  TravelStyleKey
} from "@tripmate/planner";

export type CompanionType =
  | "solo"
  | "friends"
  | "couple"
  | "family_kids"
  | "family_no_kids"
  | "parents";

export type TripPurpose =
  | "sightseeing"
  | "relaxation"
  | "activity"
  | "food_tour"
  | "filial";

export type TravelStyle = "J" | "P";

export type TransportType = "car" | "transit" | "walk";

export type TargetGroup = "young" | "family" | "senior";

export type FoodPreference =
  | "korean"
  | "chinese"
  | "japanese"
  | "western"
  | "seafood"
  | "meat"
  | "noodle"
  | "salad"
  | "cafe"
  | "dessert"
  | "pub"
  | "other";

export type BudgetRange = "under_50" | "50_100" | "100_200" | "unlimited";

export type ChildAgeGroup = "0_2" | "3_5" | "6_7" | "8_10" | "11_13";

export interface Destination {
  id: string;
  name: string;
  image: string;
  rating: number;
}

export interface FriendMatch {
  id: string;
  name: string;
  age: number;
  avatar: string;
  match: number;
  destination: string;
  dateRange: string;
  tags: string[];
  bio: string;
  checklist: string[];
}

export interface UserSignupProfile {
  email: string;
  nickname: string;
  companion: CompanionType;
  purpose: TripPurpose;
  travelStyle: TravelStyle;
  transport: TransportType;
  foods: FoodPreference[];
  childAgeGroups: ChildAgeGroup[];
}

export interface TripCreateDraft {
  title?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  styleKey?: TravelStyleKey;
  companion?: CompanionType;
  purpose?: TripPurpose;
  travelStyle?: TravelStyle;
  transport?: TransportType;
  budgetRange?: BudgetRange;
  targetGroup?: TargetGroup;
}

export interface TripRouteMapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface CurrentTripStorage {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  styleKey: TravelStyleKey;
  companion?: CompanionType | null;
  transport?: TransportType | null;
  accommodationType?: string | null;
  attractions: string[];
  restaurants: string[];
  routePoints: TripRouteMapPoint[];
  createdAt: string;
  providerWarnings?: TripPlanResult["providerWarnings"];
  normalizedPlaces?: NormalizedPlace[];
  normalizedRoute?: NormalizedRoute | null;
}

export interface TripScheduleItem {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  locationName?: string;
}
