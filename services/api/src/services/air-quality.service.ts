import axios from "axios";
import { env } from "../config/env";

interface AirQualityItem {
  stationName: string;
  dataTime: string;
  pm10Value: string;
  pm25Value: string;
  pm10Grade: string;
  pm25Grade: string;
  o3Value: string;
  khaiValue: string;
  khaiGrade: string;
}

interface AirQualityResponse {
  response?: {
    body?: {
      items?: AirQualityItem[];
    };
  };
}

// 시도별 대기질 조회
export async function getAirQuality(sidoName: string) {
  const response = await axios.get<AirQualityResponse>(
    "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty",
    {
      params: {
        serviceKey: env.dataGoKrApiKey,
        returnType: "json",
        numOfRows: 100,
        pageNo: 1,
        sidoName,
        ver: "1.0"
      }
    }
  );

  return response.data?.response?.body?.items ?? [];
}

// 등급 텍스트 변환
export function gradeToText(grade: string): string {
  switch (grade) {
    case "1":
      return "좋음";
    case "2":
      return "보통";
    case "3":
      return "나쁨";
    case "4":
      return "매우나쁨";
    default:
      return "정보없음";
  }
}

export type { AirQualityItem };
