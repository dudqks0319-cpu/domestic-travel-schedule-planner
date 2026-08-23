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

const FOOD_CATEGORY_PATTERN =
  /(음식점|카페|주점|술집|레스토랑|분식|치킨|피자|햄버거|베이커리|디저트|커피|한식|중식|일식|양식|패스트푸드|도시락)/i;

const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">"
};

function stripHtml(input: string): string {
  const noTag = input.replace(/<[^>]*>/g, "");
  return noTag.replace(/&[a-zA-Z#0-9]+;/g, (entity) => HTML_ENTITY_MAP[entity] ?? entity).trim();
}

function normalizeRestaurantQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return "맛집";
  }

  if (/(맛집|음식점|식당|카페|restaurant)/i.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed} 맛집`;
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
      query: normalizeRestaurantQuery(params.query),
      display: params.display ?? 5,
      start: params.start ?? 1,
      sort: params.sort ?? "comment"
    }
  });

  const normalizedItems = response.data.items.map((item) => ({
    ...item,
    title: stripHtml(item.title),
    category: stripHtml(item.category)
  }));

  const filteredItems = normalizedItems.filter(
    (item) => FOOD_CATEGORY_PATTERN.test(item.category) || FOOD_CATEGORY_PATTERN.test(item.title)
  );

  return filteredItems;
}

export type { NaverLocalItem, NaverSearchResponse };
