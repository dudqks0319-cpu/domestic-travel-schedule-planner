import type { FriendMatch } from "../types";

const FRIEND_MATCHES: FriendMatch[] = [
  {
    id: "mate-jeju-1",
    name: "지수",
    age: 29,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
    match: 96,
    destination: "제주 2박3일",
    dateRange: "7.12 - 7.14",
    tags: ["카페", "바다", "렌트카"],
    bio: "오전에는 여유롭게 움직이고 오후에는 바다 근처 카페를 좋아해요.",
    checklist: ["흡연 안 함", "운전 가능", "맛집 선호"]
  },
  {
    id: "mate-seoul-1",
    name: "민준",
    age: 32,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80",
    match: 91,
    destination: "서울 주말",
    dateRange: "7.20 - 7.21",
    tags: ["전시", "도보", "맛집"],
    bio: "도보 이동과 전시 관람 중심의 조용한 여행을 선호합니다.",
    checklist: ["시간 약속", "사진", "대중교통"]
  },
  {
    id: "mate-busan-1",
    name: "서연",
    age: 27,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    match: 88,
    destination: "부산 1박2일",
    dateRange: "8.02 - 8.03",
    tags: ["해변", "야경", "맛집"],
    bio: "일정은 촘촘하기보다 큰 블록으로 잡고 현장에서 조정하는 편이에요.",
    checklist: ["P형", "야경", "카페"]
  },
  {
    id: "mate-gyeongju-1",
    name: "현우",
    age: 35,
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80",
    match: 84,
    destination: "경주 역사 산책",
    dateRange: "8.10 - 8.11",
    tags: ["역사", "산책", "한식"],
    bio: "유적지와 오래된 골목을 천천히 둘러보는 여행을 좋아합니다.",
    checklist: ["도보", "조용한 코스", "로컬 맛집"]
  }
];

export async function fetchFriendMatches(): Promise<FriendMatch[]> {
  return FRIEND_MATCHES;
}

export async function fetchTopFriends(): Promise<Pick<FriendMatch, "id" | "name" | "avatar">[]> {
  return FRIEND_MATCHES.map(({ id, name, avatar }) => ({ id, name, avatar }));
}
