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
  areaCode?: string;
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
      ...(params.areaCode ? { areaCode: params.areaCode } : {}),
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

const AREA_CODE_ALIASES: Record<string, string> = {
  ...AREA_CODES,
  서울특별시: "1",
  서울시: "1",
  인천광역시: "2",
  인천시: "2",
  대전광역시: "3",
  대전시: "3",
  대구광역시: "4",
  대구시: "4",
  광주광역시: "5",
  광주시: "5",
  부산광역시: "6",
  부산시: "6",
  울산광역시: "7",
  울산시: "7",
  세종시: "8",
  세종특별자치시: "8",
  경기도: "31",
  수원: "31",
  성남: "31",
  용인: "31",
  고양: "31",
  강원도: "32",
  강원특별자치도: "32",
  춘천: "32",
  강릉: "32",
  속초: "32",
  원주: "32",
  충청북도: "33",
  청주: "33",
  충주: "33",
  제천: "33",
  충청남도: "34",
  천안: "34",
  아산: "34",
  공주: "34",
  보령: "34",
  경상북도: "35",
  경주: "35",
  포항: "35",
  안동: "35",
  구미: "35",
  경상남도: "36",
  창원: "36",
  진주: "36",
  통영: "36",
  거제: "36",
  김해: "36",
  전라북도: "37",
  전북특별자치도: "37",
  전주: "37",
  군산: "37",
  익산: "37",
  남원: "37",
  전라남도: "38",
  여수: "38",
  순천: "38",
  목포: "38",
  광양: "38",
  제주도: "39",
  제주특별자치도: "39"
};

function normalizeLocationName(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function resolveAreaCode(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = normalizeLocationName(raw);
  if (!normalized) {
    return undefined;
  }

  const exact = AREA_CODE_ALIASES[normalized];
  if (exact) {
    return exact;
  }

  const stripped = normalized.replace(
    /(특별시|광역시|특별자치시|자치시|특별자치도|자치도|시|군|구|도)$/g,
    ""
  );
  if (stripped && AREA_CODE_ALIASES[stripped]) {
    return AREA_CODE_ALIASES[stripped];
  }

  const partialMatch = Object.entries(AREA_CODE_ALIASES).find(([name]) =>
    normalized.includes(name)
  );
  return partialMatch?.[1];
}

export type { TourItem, TourApiResponse };
