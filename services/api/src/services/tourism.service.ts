import axios from "axios";
import { env } from "../config/env";

const TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService1";

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
    body: {
      items?: { item?: TourItem[] };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

// 지역 기반 관광지 검색
export async function searchAttractions(params: {
  areaCode: string;
  contentTypeId?: string;
  pageNo?: number;
  numOfRows?: number;
}) {
  const response = await axios.get<TourApiResponse>(`${TOUR_API_BASE}/areaBasedList1`, {
    params: {
      serviceKey: env.dataGoKrApiKey,
      numOfRows: params.numOfRows ?? 20,
      pageNo: params.pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      listYN: "Y",
      arrange: "P",
      areaCode: params.areaCode,
      contentTypeId: params.contentTypeId ?? "12"
    }
  });

  return response.data.response.body.items?.item ?? [];
}

// 키워드 검색
export async function searchByKeyword(keyword: string, pageNo?: number) {
  const response = await axios.get<TourApiResponse>(`${TOUR_API_BASE}/searchKeyword1`, {
    params: {
      serviceKey: env.dataGoKrApiKey,
      numOfRows: 20,
      pageNo: pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      listYN: "Y",
      arrange: "P",
      keyword: encodeURIComponent(keyword)
    }
  });

  return response.data.response.body.items?.item ?? [];
}

// 축제/행사 검색
export async function searchFestivals(params: {
  eventStartDate: string;
  areaCode?: string;
  pageNo?: number;
}) {
  const response = await axios.get<TourApiResponse>(`${TOUR_API_BASE}/searchFestival1`, {
    params: {
      serviceKey: env.dataGoKrApiKey,
      numOfRows: 20,
      pageNo: params.pageNo ?? 1,
      MobileOS: "AND",
      MobileApp: "TripMate",
      _type: "json",
      listYN: "Y",
      arrange: "P",
      eventStartDate: params.eventStartDate,
      areaCode: params.areaCode
    }
  });

  return response.data.response.body.items?.item ?? [];
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
