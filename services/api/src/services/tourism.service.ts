import axios from "axios";
import { env } from "../config/env";

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2";

function normalizeServiceKey(raw: string): string {
  if (!raw) return "";
  try {
    // 공공데이터 키가 이미 인코딩된 상태로 저장되어 있어도 1회 인코딩으로 맞춘다.
    return encodeURIComponent(decodeURIComponent(raw));
  } catch {
    return encodeURIComponent(raw);
  }
}

function withServiceKey(path: string): string {
  const key = normalizeServiceKey(env.dataGoKrApiKey);
  return `${TOUR_API_BASE}/${path}?serviceKey=${key}`;
}

interface TourItem {
  contentid: string;
  title: string;
  addr1: string;
  addr2?: string;
  firstimage?: string;
  firstimage2?: string;
  mapx: string;
  mapy: string;
  tel?: string;
  contenttypeid: string;
}

interface TourApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body?: {
      items?: { item?: TourItem[] };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

function readItems(payload: unknown): TourItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const response = (payload as { response?: { body?: { items?: { item?: TourItem[] | TourItem } } } }).response;
  const item = response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

// 지역 기반 관광지 검색
export async function searchAttractions(params: {
  areaCode: string;
  contentTypeId?: string;
  pageNo?: number;
  numOfRows?: number;
}) {
  const response = await axios.get<TourApiResponse>(withServiceKey("areaBasedList2"), {
    params: {
      numOfRows: params.numOfRows ?? 20,
      pageNo: params.pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      arrange: "P",
      areaCode: params.areaCode,
      contentTypeId: params.contentTypeId ?? "12"
    }
  });

  return readItems(response.data);
}

// 키워드 검색
export async function searchByKeyword(keyword: string, pageNo?: number) {
  const response = await axios.get<TourApiResponse>(withServiceKey("searchKeyword2"), {
    params: {
      numOfRows: 20,
      pageNo: pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      arrange: "P",
      keyword
    }
  });

  return readItems(response.data);
}

// 축제/행사 검색
export async function searchFestivals(params: {
  eventStartDate: string;
  areaCode?: string;
  pageNo?: number;
}) {
  const response = await axios.get<TourApiResponse>(withServiceKey("searchFestival2"), {
    params: {
      numOfRows: 20,
      pageNo: params.pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      arrange: "P",
      eventStartDate: params.eventStartDate,
      areaCode: params.areaCode
    }
  });

  return readItems(response.data);
}

// 지역코드 매핑
export const AREA_CODES: Record<string, string> = {
  서울: "1",
  인천: "2",
  대전: "3",
  대구: "4",
  광주: "5",
  부산: "6",
  울산: "7",
  세종: "8",
  경기: "31",
  강원: "32",
  충북: "33",
  충남: "34",
  경북: "35",
  경남: "36",
  전북: "37",
  전남: "38",
  제주: "39"
};

export type { TourItem, TourApiResponse };
