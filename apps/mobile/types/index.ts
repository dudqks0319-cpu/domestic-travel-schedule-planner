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

export type TripTravelMode = "driving" | "transit" | "walking";

export type TripProviderStatus = "ready" | "empty" | "unavailable";

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
  companion?: CompanionType;
  purpose?: TripPurpose;
  travelStyle?: TravelStyle;
  transport?: TransportType;
  budgetRange?: BudgetRange;
  targetGroup?: TargetGroup;
}

export interface TripRouteMapPoint {
  id: string;
  tripPlaceId?: string;
  providerPlaceId?: string;
  name: string;
  latitude: number;
  longitude: number;
  dayNumber?: number;
}

export interface CurrentTripStorage {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  style: string;
  styleKey: string;
  transport: TransportType;
  mode: TripTravelMode;
  providerStatus: TripProviderStatus;
  routePoints: TripRouteMapPoint[];
  createdAt: string;
}

export interface TripScheduleItem {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  locationName?: string;
}

export interface FriendMatch {
  id: string;
  name: string;
  age: number;
  avatar: string;
  destination: string;
  dateRange: string;
  match: number;
  tags: string[];
  bio: string;
  checklist: string[];
}
