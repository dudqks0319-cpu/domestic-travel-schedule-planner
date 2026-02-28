import axios from "axios";
import { env } from "../config/env";

const WEATHER_API_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

interface WeatherItem {
  baseDate: string;
  baseTime: string;
  category: string;
  fcstDate: string;
  fcstTime: string;
  fcstValue: string;
  nx: number;
  ny: number;
}

interface WeatherApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items?: { item?: WeatherItem[] };
    };
  };
}

// 단기예보 조회
export async function getShortTermForecast(params: {
  nx: number;
  ny: number;
  baseDate: string;
  baseTime: string;
}) {
  const response = await axios.get<WeatherApiResponse>(`${WEATHER_API_BASE}/getVilageFcst`, {
    params: {
      serviceKey: env.kmaApiKey,
      numOfRows: 300,
      pageNo: 1,
      dataType: "JSON",
      base_date: params.baseDate,
      base_time: params.baseTime,
      nx: params.nx,
      ny: params.ny
    }
  });

  return response.data.response.body.items?.item ?? [];
}

// 위도/경도 → 기상청 격자 좌표 변환
export function toGridCoord(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)
  };
}

// 주요 관광지 격자좌표
export const POPULAR_GRIDS: Record<string, { nx: number; ny: number }> = {
  서울: { nx: 60, ny: 127 },
  부산: { nx: 98, ny: 76 },
  제주: { nx: 52, ny: 38 },
  강릉: { nx: 92, ny: 131 },
  경주: { nx: 100, ny: 91 },
  여수: { nx: 73, ny: 66 },
  전주: { nx: 63, ny: 89 },
  속초: { nx: 87, ny: 141 }
};

export type { WeatherItem, WeatherApiResponse };
