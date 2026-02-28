import axios from "axios";
import { env } from "../config/env";

interface JusoItem {
  roadAddr: string;
  jibunAddr: string;
  zipNo: string;
  admCd: string;
  bdNm: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
}

interface JusoApiResponse {
  results: {
    common: {
      errorCode: string;
      errorMessage: string;
      totalCount: string;
    };
    juso?: JusoItem[];
  };
}

// 주소 검색 (자동완성)
export async function searchAddress(keyword: string, pageNo?: number) {
  const response = await axios.get<JusoApiResponse>("https://business.juso.go.kr/addrlink/addrLinkApi.do", {
    params: {
      confmKey: env.jusoSearchApiKey,
      currentPage: pageNo ?? 1,
      countPerPage: 10,
      keyword,
      resultType: "json"
    }
  });

  return response.data.results.juso ?? [];
}

export type { JusoItem, JusoApiResponse };
