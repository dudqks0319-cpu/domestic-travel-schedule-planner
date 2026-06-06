export interface TravelRegion {
  id: string;
  name: string;
  province: string;
  tagline: string;
  styles: string[];
  days: string;
  left: `${number}%`;
  top: `${number}%`;
  color: string;
}

export const TRAVEL_REGIONS: readonly TravelRegion[] = [
  { id: "seoul", name: "서울", province: "수도권", tagline: "전시, 맛집, 야경을 하루 단위로 묶기 좋아요.", styles: ["도심", "전시", "맛집"], days: "당일-2일", left: "48%", top: "20%", color: "#4A90E2" },
  { id: "gangneung", name: "강릉", province: "강원", tagline: "바다, 카페, 중앙시장 동선을 빠르게 잡을 수 있어요.", styles: ["바다", "카페", "맛집"], days: "1박2일", left: "70%", top: "25%", color: "#0D9488" },
  { id: "sokcho", name: "속초", province: "강원", tagline: "설악산, 중앙시장, 바다 코스를 짧게 묶기 좋아요.", styles: ["산", "시장", "바다"], days: "1박2일", left: "69%", top: "17%", color: "#0284C7" },
  { id: "chuncheon", name: "춘천", province: "강원", tagline: "호수, 닭갈비, 당일치기 드라이브에 잘 맞아요.", styles: ["호수", "맛집", "드라이브"], days: "당일-1박", left: "57%", top: "23%", color: "#059669" },
  { id: "incheon", name: "인천", province: "수도권", tagline: "바다, 섬, 차이나타운 코스를 가볍게 만들 수 있어요.", styles: ["바다", "섬", "맛집"], days: "당일-1박", left: "37%", top: "25%", color: "#2563EB" },
  { id: "gyeonggi", name: "경기", province: "수도권", tagline: "근교 카페와 가족 나들이 장소를 빠르게 묶어요.", styles: ["근교", "카페", "가족"], days: "당일-1박", left: "47%", top: "29%", color: "#7C3AED" },
  { id: "daejeon", name: "대전", province: "충청", tagline: "과학, 성심당, 근교 산책을 하루 일정으로 만들기 좋아요.", styles: ["도심", "맛집", "산책"], days: "당일-1박", left: "49%", top: "47%", color: "#9333EA" },
  { id: "sejong", name: "세종", province: "충청", tagline: "호수공원과 근교 맛집을 여유 있게 연결해요.", styles: ["공원", "가족", "카페"], days: "당일", left: "46%", top: "43%", color: "#7E22CE" },
  { id: "chungbuk", name: "충북", province: "충청", tagline: "단양, 제천, 충주 권역을 자연 중심으로 나눠요.", styles: ["자연", "드라이브", "휴식"], days: "1박2일", left: "56%", top: "41%", color: "#16A34A" },
  { id: "chungnam", name: "충남", province: "충청", tagline: "서해, 온천, 역사 코스를 차분하게 구성해요.", styles: ["서해", "온천", "역사"], days: "1박2일", left: "36%", top: "45%", color: "#CA8A04" },
  { id: "daegu", name: "대구", province: "경북", tagline: "도심 맛집과 근교 산책을 짧은 일정으로 묶어요.", styles: ["맛집", "도심", "카페"], days: "당일-1박", left: "63%", top: "54%", color: "#DC2626" },
  { id: "gyeongju", name: "경주", province: "경북", tagline: "역사 명소와 황리단길을 날짜별로 나누기 좋아요.", styles: ["역사", "산책", "카페"], days: "1박2일", left: "67%", top: "58%", color: "#B45309" },
  { id: "pohang", name: "포항", province: "경북", tagline: "바다, 시장, 전망 명소를 드라이브로 연결해요.", styles: ["바다", "시장", "전망"], days: "1박2일", left: "72%", top: "55%", color: "#0891B2" },
  { id: "gyeongbuk", name: "경북", province: "경북", tagline: "안동, 영주, 문경 같은 역사·자연 권역을 나눠요.", styles: ["역사", "자연", "한옥"], days: "1박2일", left: "65%", top: "45%", color: "#A16207" },
  { id: "busan", name: "부산", province: "부산", tagline: "해변, 시장, 야경 코스를 권역별로 묶어 보세요.", styles: ["바다", "시장", "야경"], days: "2박3일", left: "72%", top: "68%", color: "#2563EB" },
  { id: "gyeongnam", name: "경남", province: "경남", tagline: "통영, 거제, 남해 코스를 바다 중심으로 묶어요.", styles: ["바다", "섬", "드라이브"], days: "1박2일", left: "62%", top: "70%", color: "#0F766E" },
  { id: "jeonju", name: "전주", province: "전북", tagline: "한옥마을과 로컬 맛집을 여유 있게 배치해요.", styles: ["한옥", "맛집", "산책"], days: "1박2일", left: "42%", top: "58%", color: "#7C3AED" },
  { id: "jeonbuk", name: "전북", province: "전북", tagline: "군산, 부안, 남원 권역을 취향별로 나눠요.", styles: ["근대문화", "자연", "맛집"], days: "1박2일", left: "37%", top: "61%", color: "#6D28D9" },
  { id: "gwangju", name: "광주", province: "광주", tagline: "예술, 맛집, 근교 자연을 균형 있게 배치해요.", styles: ["예술", "맛집", "카페"], days: "당일-1박", left: "38%", top: "69%", color: "#DB2777" },
  { id: "jeonnam", name: "전남", province: "전남", tagline: "남도 맛집과 섬·정원 코스를 여유롭게 구성해요.", styles: ["남도", "섬", "자연"], days: "1박2일", left: "34%", top: "76%", color: "#BE185D" },
  { id: "yeosu", name: "여수", province: "전남", tagline: "해상 케이블카, 밤바다, 시장 코스를 이어 보세요.", styles: ["바다", "야경", "해산물"], days: "1박2일", left: "49%", top: "72%", color: "#DB2777" },
  { id: "suncheon", name: "순천", province: "전남", tagline: "정원, 습지, 로컬 맛집을 천천히 둘러보기 좋아요.", styles: ["정원", "습지", "맛집"], days: "1박2일", left: "45%", top: "75%", color: "#15803D" },
  { id: "gangwon", name: "강원", province: "강원", tagline: "산, 바다, 카페 권역을 계절에 맞게 나눠요.", styles: ["산", "바다", "카페"], days: "1박2일", left: "63%", top: "31%", color: "#047857" },
  { id: "jeju", name: "제주", province: "제주", tagline: "동서남북 권역을 나눠 이동시간 낭비를 줄여요.", styles: ["자연", "카페", "드라이브"], days: "2박3일", left: "33%", top: "88%", color: "#16A34A" }
];

export const DEFAULT_TRAVEL_REGION_ID = "gangneung";
