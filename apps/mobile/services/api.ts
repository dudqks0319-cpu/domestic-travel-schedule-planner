import axios, { type AxiosRequestConfig } from "axios";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "../lib/secure-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const API_PREFIX = "/api/v1";

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
  baseURL: `${API_BASE}${API_PREFIX}`,
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
      const res = await axios.post(`${API_BASE}${API_PREFIX}/auth/refresh`, { refreshToken });
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

export const authApi = {
  kakaoLogin: (kakaoAccessToken: string) =>
    apiClient.post("/auth/login/kakao", { kakaoAccessToken }),
  getMe: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout"),
};

export const plannerApi = {
  generate: (params: {
    destination: string;
    startDate: string;
    endDate: string;
    transport?: string;
    companions?: string;
    attractionKeywords?: string[];
    restaurantKeywords?: string[];
  }) => apiClient.post("/planner/generate", params),
  replan: (tripId: string) => apiClient.post(`/planner/trips/${tripId}/replan`),
  summary: (tripId: string) => apiClient.get(`/planner/trips/${tripId}/summary`),
  suggestions: () => apiClient.get("/planner/suggestions/destinations"),
};

export const tripsApi = {
  list: () => apiClient.get("/trips"),
  create: (data: Record<string, unknown>) => apiClient.post("/trips", data),
  get: (tripId: string) => apiClient.get(`/trips/${tripId}`),
  update: (tripId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/trips/${tripId}`, data),
  delete: (tripId: string) => apiClient.delete(`/trips/${tripId}`),
  getDays: (tripId: string) => apiClient.get(`/trips/${tripId}/days`),
  createDay: (tripId: string, data: Record<string, unknown>) =>
    apiClient.post(`/trips/${tripId}/days`, data),
  getPlaces: (tripId: string, dayId: string) =>
    apiClient.get(`/trips/${tripId}/days/${dayId}/places`),
  createPlace: (tripId: string, dayId: string, data: Record<string, unknown>) =>
    apiClient.post(`/trips/${tripId}/days/${dayId}/places`, data),
  updatePlace: (tripId: string, dayId: string, placeId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/trips/${tripId}/days/${dayId}/places/${placeId}`, data),
  deletePlace: (tripId: string, dayId: string, placeId: string) =>
    apiClient.delete(`/trips/${tripId}/days/${dayId}/places/${placeId}`),
};
