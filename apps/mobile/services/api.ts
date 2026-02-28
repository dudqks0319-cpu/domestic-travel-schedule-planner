import axios, { type AxiosRequestConfig } from "axios";
import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken
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
    Authorization: `Bearer ${token}`
  };
}

const apiClient = axios.create({
  baseURL: `${API_BASE}${API_PREFIX}`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" }
});

// 요청 인터셉터: 자동으로 토큰 추가
apiClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    applyAuthorizationHeader(config, token);
  }
  return config;
});

// 응답 인터셉터: 401이면 토큰 갱신 시도
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

// === API 함수들 ===

// 관광지 검색
export const tourismApi = {
  getAttractions: (area: string, page?: number) =>
    apiClient.get("/tourism/attractions", { params: { area, page } }),
  search: (keyword: string, page?: number) =>
    apiClient.get("/tourism/search", { params: { keyword, page } }),
  getFestivals: (startDate: string, area?: string) =>
    apiClient.get("/tourism/festivals", { params: { startDate, area } })
};

// 날씨
export const weatherApi = {
  getForecast: (city: string) => apiClient.get("/weather/forecast", { params: { city } }),
  getAir: (sido: string) => apiClient.get("/weather/air", { params: { sido } })
};

// 맛집
export const restaurantApi = {
  search: (query: string, display?: number) =>
    apiClient.get("/restaurants/search", { params: { query, display } })
};

// 병원/약국
export const medicalApi = {
  hospitals: (lat: number, lng: number) =>
    apiClient.get("/medical/hospitals", { params: { lat, lng } }),
  pharmacies: (lat: number, lng: number) =>
    apiClient.get("/medical/pharmacies", { params: { lat, lng } })
};

// 인증
export const authApi = {
  kakaoLogin: (kakaoAccessToken: string) => apiClient.post("/auth/login/kakao", { kakaoAccessToken }),
  getMe: () => apiClient.get("/auth/me"),
  logout: () => apiClient.post("/auth/logout")
};
