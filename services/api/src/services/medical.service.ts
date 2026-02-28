import axios from "axios";
import { env } from "../config/env";

function withServiceKey(url: string): string {
  const key = encodeURIComponent(env.dataGoKrApiKey);
  return `${url}?serviceKey=${key}`;
}

interface HospitalItem {
  dutyName: string;
  dutyAddr: string;
  dutyTel1: string;
  wgs84Lat: string;
  wgs84Lon: string;
  dutyTime1s?: string;
  dutyTime1c?: string;
  dgidIdName?: string;
}

interface PharmacyItem {
  dutyName: string;
  dutyAddr: string;
  dutyTel1: string;
  wgs84Lat: string;
  wgs84Lon: string;
  dutyTime1s?: string;
  dutyTime1c?: string;
}

interface DataGoResponse<T> {
  response?: {
    body?: {
      items?: {
        item?: T[] | T;
      };
    };
  };
}

function normalizeItems<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// 병원 검색 (위치 기반)
export async function searchHospitals(params: {
  lat: number;
  lng: number;
  pageNo?: number;
}) {
  const response = await axios.get<DataGoResponse<HospitalItem>>(
    withServiceKey(
      "https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncListInfoInqire"
    ),
    {
      params: {
        WGS84_LAT: params.lat,
        WGS84_LON: params.lng,
        pageNo: params.pageNo ?? 1,
        numOfRows: 10,
        _type: "json"
      }
    }
  );

  return normalizeItems(response.data?.response?.body?.items?.item);
}

// 약국 검색 (위치 기반)
export async function searchPharmacies(params: {
  lat: number;
  lng: number;
  pageNo?: number;
}) {
  const response = await axios.get<DataGoResponse<PharmacyItem>>(
    withServiceKey(
      "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire"
    ),
    {
      params: {
        WGS84_LAT: params.lat,
        WGS84_LON: params.lng,
        pageNo: params.pageNo ?? 1,
        numOfRows: 10,
        _type: "json"
      }
    }
  );

  return normalizeItems(response.data?.response?.body?.items?.item);
}

export type { HospitalItem, PharmacyItem };
