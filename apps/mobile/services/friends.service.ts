import { FriendMatch } from "../types";
import { supabase } from "../lib/supabase";

export const MOCK_FRIENDS = [
    { id: "f1", name: "Minji", avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&q=80" },
    { id: "f2", name: "Suho", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80" },
    { id: "f3", name: "Jiwoo", avatar: "https://images.unsplash.com/photo-1542206395-9feb3edaa68d?w=200&q=80" },
    { id: "f4", name: "Hana", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80" },
];

const MOCK_FRIEND_MATCHES: FriendMatch[] = [
    {
        id: "mate-1",
        name: "지은",
        age: 27,
        destination: "제주도",
        dateRange: "3월 15-19일",
        bio: "같이 밥 먹을 사람 찾아요",
        match: 92,
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&q=80",
        tags: ["액티비티", "맛집투어"],
        checklist: ["카페 투어", "사진 촬영", "사정 및 도움"],
    },
    {
        id: "mate-2",
        name: "민수",
        age: 29,
        destination: "서울",
        dateRange: "4월 5-10일",
        bio: "문화 탐방 같이 해요",
        match: 85,
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&q=80",
        tags: ["도시투어", "쇼핑"],
        checklist: ["미술관 관람", "도보 여행", "식물원 관람"],
    },
    {
        id: "mate-3",
        name: "하윤",
        age: 31,
        destination: "부산",
        dateRange: "5월 2-5일",
        bio: "야경 스팟 같이 다니실 분",
        match: 81,
        avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&q=80",
        tags: ["야경", "드라이브"],
        checklist: ["광안리", "사진 스팟", "저녁 코스"],
    }
];

export async function fetchFriendMatches(): Promise<FriendMatch[]> {
    if (supabase) {
        const { data, error } = await supabase.from("friend_matches").select("*");
        if (error) {
            console.error("fetchFriendMatches error:", error);
            return MOCK_FRIEND_MATCHES;
        }
        // Convert array strings if they are returned identically stringified
        return (data || []).map((item: any) => ({
            ...item,
            tags: Array.isArray(item.tags) ? item.tags : [],
            checklist: Array.isArray(item.checklist) ? item.checklist : [],
        })) as FriendMatch[];
    }
    return Promise.resolve(MOCK_FRIEND_MATCHES);
}

export async function fetchTopFriends() {
    // In real case, fetch from 'users' table or friends table
    return Promise.resolve(MOCK_FRIENDS);
}
