import type { AffiliateProvider } from "./monetization";

export interface AffiliateOffer {
  provider: AffiliateProvider;
  title: string;
  description: string;
  envName: string;
  targetUrl?: string;
}

function readPublicEnv(name: string): string | undefined {
  const maybeProcess = (
    globalThis as {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process;

  const value = maybeProcess?.env?.[name]?.trim();
  if (!value || !value.startsWith("https://")) {
    return undefined;
  }

  return value;
}

export function getAffiliateOffers(): AffiliateOffer[] {
  const configs: Array<Omit<AffiliateOffer, "targetUrl">> = [
    {
      provider: "hotel",
      title: "숙소 예약",
      description: "일정 근처 숙소를 외부 예약 서비스에서 확인",
      envName: "EXPO_PUBLIC_AFFILIATE_HOTEL_URL"
    },
    {
      provider: "rental_car",
      title: "렌터카",
      description: "드라이브 여행 이동수단을 외부 서비스에서 확인",
      envName: "EXPO_PUBLIC_AFFILIATE_RENTAL_CAR_URL"
    },
    {
      provider: "ticket",
      title: "입장권",
      description: "관광지·전시·액티비티 티켓을 외부 서비스에서 확인",
      envName: "EXPO_PUBLIC_AFFILIATE_TICKET_URL"
    },
    {
      provider: "insurance",
      title: "여행자보험",
      description: "국내여행 보험 상품을 외부 서비스에서 확인",
      envName: "EXPO_PUBLIC_AFFILIATE_INSURANCE_URL"
    },
    {
      provider: "local_tour",
      title: "지역 투어",
      description: "가이드 투어와 체험 상품을 외부 서비스에서 확인",
      envName: "EXPO_PUBLIC_AFFILIATE_LOCAL_TOUR_URL"
    }
  ];

  return configs.map((config) => ({
    ...config,
    targetUrl: readPublicEnv(config.envName)
  }));
}
