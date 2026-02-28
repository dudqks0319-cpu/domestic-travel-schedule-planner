import axios from "axios";
import { env } from "../config/env";

interface NaverLocalItem {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
  mapx: string;
  mapy: string;
}

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverLocalItem[];
}

// 맛집 검색
export async function searchRestaurants(params: {
  query: string;
  display?: number;
  start?: number;
  sort?: "random" | "comment";
}) {
  const response = await axios.get<NaverSearchResponse>("https://openapi.naver.com/v1/search/local.json", {
    headers: {
      "X-Naver-Client-Id": env.naverClientId,
      "X-Naver-Client-Secret": env.naverClientSecret
    },
    params: {
      query: params.query,
      display: params.display ?? 5,
      start: params.start ?? 1,
      sort: params.sort ?? "comment"
    }
  });

  return response.data.items.map((item) => ({
    ...item,
    title: item.title.replace(/<[^>]*>/g, "")
  }));
}

export type { NaverLocalItem, NaverSearchResponse };
