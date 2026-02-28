import axios from "axios";
import { env } from "../config/env";

interface KakaoPlaceItem {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance?: string;
}

interface KakaoPlaceResponse {
  documents: KakaoPlaceItem[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

interface KakaoAddressResponse {
  documents?: Array<{
    address_name: string;
    y: string;
    x: string;
    road_address?: {
      address_name: string;
    };
  }>;
}

// 키워드 장소 검색
export async function searchPlace(params: {
  query: string;
  x?: string;
  y?: string;
  radius?: number;
  page?: number;
  size?: number;
}) {
  const response = await axios.get<KakaoPlaceResponse>(
    "https://dapi.kakao.com/v2/local/search/keyword.json",
    {
      headers: {
        Authorization: `KakaoAK ${env.kakaoRestApiKey}`
      },
      params: {
        query: params.query,
        x: params.x,
        y: params.y,
        radius: params.radius,
        page: params.page ?? 1,
        size: params.size ?? 15
      }
    }
  );

  return response.data;
}

// 주소 → 좌표 변환
export async function addressToCoord(address: string) {
  const response = await axios.get<KakaoAddressResponse>(
    "https://dapi.kakao.com/v2/local/search/address.json",
    {
      headers: {
        Authorization: `KakaoAK ${env.kakaoRestApiKey}`
      },
      params: { query: address }
    }
  );

  const doc = response.data.documents?.[0];
  if (!doc) return null;

  return {
    address: doc.address_name,
    roadAddress: doc.road_address?.address_name ?? null,
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x)
  };
}

export type { KakaoPlaceItem, KakaoPlaceResponse };
