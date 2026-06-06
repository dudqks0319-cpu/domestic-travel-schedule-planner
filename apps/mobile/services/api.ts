import axios, { type AxiosRequestConfig } from "axios";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "../lib/secure-storage";
import { getApiOriginUrl, getApiV1BaseUrl } from "./apiBase";

const API_BASE = getApiV1BaseUrl();
const API_ORIGIN = getApiOriginUrl();

type RetriableRequestConfig = {
  url?: string;
  _retry?: boolean;
} & AxiosRequestConfig;

function applyAuthorizationHeader(
  config: { headers?: AxiosRequestConfig["headers"] },
  token: string
): void {
  if (config.headers && typeof (config.headers as { set?: unknown }).set === "function") {
    (config.headers as { set: (name: string, value: string) => void }).set(
      "Authorization",
      `Bearer ${token}`
    );
    return;
  }
  config.headers = {
    ...(config.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token}`,
  };
}

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) applyAuthorizationHeader(config, token);
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    if (!isUnauthorized || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (typeof originalRequest.url === "string" && originalRequest.url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      await clearSessionTokens();
      return Promise.reject(error);
    }
    originalRequest._retry = true;
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
      const newToken = res.data.accessToken as string;
      await setAccessToken(newToken);
      applyAuthorizationHeader(originalRequest, newToken);
      return apiClient(originalRequest as AxiosRequestConfig);
    } catch {
      await clearSessionTokens();
    }
    return Promise.reject(error);
  }
);

export default apiClient;

export const tourismApi = {
  getAttractions: (area: string, page?: number, contentType?: string) =>
    apiClient.get("/tourism/attractions", { params: { area, page, contentType } }),
  search: (keyword: string, page?: number) =>
    apiClient.get("/tourism/search", { params: { keyword, page } }),
  getFestivals: (startDate: string, area?: string) =>
    apiClient.get("/tourism/festivals", { params: { startDate, area } }),
};

export const weatherApi = {
  getForecast: (city: string) => apiClient.get("/weather/forecast", { params: { city } }),
  getForecastByCoord: (lat: number, lng: number) =>
    apiClient.get("/weather/forecast", { params: { lat, lng } }),
  getAir: (sido: string) => apiClient.get("/weather/air", { params: { sido } }),
};

export const restaurantApi = {
  search: (query: string, display?: number) =>
    apiClient.get("/restaurants/search", { params: { query, display } }),
};

export const medicalApi = {
  hospitals: (lat: number, lng: number) =>
    apiClient.get("/medical/hospitals", { params: { lat, lng } }),
  pharmacies: (lat: number, lng: number) =>
    apiClient.get("/medical/pharmacies", { params: { lat, lng } }),
};

export const addressApi = {
  search: (keyword: string, page?: number) =>
    apiClient.get("/address/search", { params: { keyword, page } }),
};

export interface NormalizedPlaceDto {
  id: string;
  provider: "naver" | "kakao" | "tour" | "manual";
  providerPlaceId?: string;
  name: string;
  category: string;
  address?: string;
  roadAddress?: string;
  lat: number;
  lng: number;
  phone?: string;
  imageUrl?: string;
  sourceUrl?: string;
  description?: string;
  tags: string[];
  score: number;
  isSponsored: boolean;
  sponsorLabel?: string;
}

export interface TripPlaceDto {
  id: string;
  tripId: string;
  dayId?: string | null;
  providerPlaceId?: string | null;
  name: string;
  category: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  dayNumber?: number | null;
  sortOrder?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  isSponsored: boolean;
  sponsorLabel?: string | null;
}

export interface TripDto {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  styleKey?: string | null;
  transportMode?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TripWithPlacesDto extends TripDto {
  places: TripPlaceDto[];
}

export interface TripShareDto {
  id: string;
  token: string;
  tripId: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface TripExportDto {
  id: string;
  tripId: string;
  format: "pdf" | "image";
  status: "queued" | "ready" | "failed" | "expired";
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string | null;
}

export interface PlannerGenerateParams {
  destination: string;
  startDate: string;
  endDate: string;
  styleKey?: string;
  mode?: string;
  transport?: string;
  transportMode?: string;
  companions?: string;
  keyword?: string;
  attractionKeywords?: string[];
  restaurantKeywords?: string[];
}

export interface PlannerReplanParams extends PlannerGenerateParams {
  trip?: Partial<PlannerGenerateParams>;
  places?: NormalizedPlaceDto[];
  lockedPlaceIds?: string[];
  removedPlaceIds?: string[];
  replacementQuery?: string;
}

export function buildTripShareUrl(token: string): string {
  return `${API_ORIGIN}/share/${encodeURIComponent(token)}`;
}

export const placesApi = {
  search: (params: {
    query: string;
    category?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    limit?: number;
  }) => apiClient.get<{ ok: true; places: NormalizedPlaceDto[]; warnings: string[]; cacheStatus: string }>(
    "/places/search",
    { params }
  ),
  get: (placeId: string) =>
    apiClient.get<{ ok: true; place: NormalizedPlaceDto }>(`/places/${encodeURIComponent(placeId)}`),
};

export const authApi = {
  kakaoLogin: (kakaoAccessToken: string) =>
    apiClient.post("/auth/login/kakao", { kakaoAccessToken }),
  getMe: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),
  deleteMe: () => apiClient.delete("/auth/me"),
};

export const plannerApi = {
  generate: (params: PlannerGenerateParams) => apiClient.post("/planner/generate", params),
  replan: (params: PlannerReplanParams) => apiClient.post("/planner/replan", params),
};

export const tripsApi = {
  list: () => apiClient.get<{ ok: true; trips: TripDto[] }>("/trips"),
  listWithPlaces: () =>
    apiClient.get<{ ok: true; trips: TripWithPlacesDto[] }>("/trips", {
      params: { include: "places" }
    }),
  create: (data: Record<string, unknown>) => apiClient.post("/trips", data),
  get: (tripId: string) => apiClient.get<{ ok: true; trip: TripDto }>(`/trips/${tripId}`),
  update: (tripId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/trips/${tripId}`, data),
  delete: (tripId: string) => apiClient.delete(`/trips/${tripId}`),
  createShare: (tripId: string) =>
    apiClient.post<{ ok: true; share: TripShareDto }>(`/trips/${tripId}/share`),
  createExport: (tripId: string, format: "pdf" | "image") =>
    apiClient.post<{ ok: true; export: TripExportDto }>(`/trips/${tripId}/exports`, { format }),
  getExport: (tripId: string, exportId: string) =>
    apiClient.get<{ ok: true; export: TripExportDto }>(`/trips/${tripId}/exports/${exportId}`),
  getDays: (tripId: string) => apiClient.get(`/trips/${tripId}/days`),
  createDay: (tripId: string, data: Record<string, unknown>) =>
    apiClient.post(`/trips/${tripId}/days`, data),
  getPlacesByTrip: (tripId: string) =>
    apiClient.get<{ ok: true; places: TripPlaceDto[] }>(`/trips/${tripId}/places`),
  getPlaces: (tripId: string, dayId: string) =>
    apiClient.get<{ ok: true; places: TripPlaceDto[] }>(`/trips/${tripId}/days/${dayId}/places`),
  addPlace: (tripId: string, data: Record<string, unknown>) =>
    apiClient.post<{ ok: true; place: TripPlaceDto }>(`/trips/${tripId}/places`, data),
  createPlace: (tripId: string, dayId: string, data: Record<string, unknown>) =>
    apiClient.post(`/trips/${tripId}/days/${dayId}/places`, data),
  updatePlaceById: (tripId: string, placeId: string, data: Record<string, unknown>) =>
    apiClient.patch<{ ok: true; place: TripPlaceDto }>(`/trips/${tripId}/places/${placeId}`, data),
  updatePlace: (tripId: string, dayId: string, placeId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/trips/${tripId}/days/${dayId}/places/${placeId}`, data),
  deletePlaceById: (tripId: string, placeId: string) =>
    apiClient.delete<{ ok: true; deleted: true }>(`/trips/${tripId}/places/${placeId}`),
  deletePlace: (tripId: string, dayId: string, placeId: string) =>
    apiClient.delete(`/trips/${tripId}/days/${dayId}/places/${placeId}`),
};
