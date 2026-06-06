import type { FriendMatch } from "../types";

const FRIEND_MATCHES: FriendMatch[] = [
  {
    id: "mate-jeju-1",
    name: "민서",
    age: 29,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop",
    destination: "제주",
    dateRange: "2박3일",
    match: 94,
    tags: ["카페", "드라이브", "사진"],
    bio: "동쪽 해안도로와 조용한 카페를 좋아해요.",
    checklist: ["렌트카", "오전 출발", "맛집"]
  },
  {
    id: "mate-gangneung-1",
    name: "지훈",
    age: 32,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop",
    destination: "강릉",
    dateRange: "1박2일",
    match: 88,
    tags: ["바다", "커피", "시장"],
    bio: "바다 보고 커피 마시는 느슨한 일정을 선호합니다.",
    checklist: ["KTX", "중앙시장", "해변"]
  },
  {
    id: "mate-seoul-1",
    name: "서연",
    age: 27,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop",
    destination: "서울",
    dateRange: "당일",
    match: 83,
    tags: ["전시", "맛집", "야경"],
    bio: "전시와 저녁 코스를 짧게 묶는 여행을 좋아해요.",
    checklist: ["대중교통", "전시 예약", "야경"]
  }
];

export async function fetchFriendMatches(): Promise<FriendMatch[]> {
  return FRIEND_MATCHES;
}
