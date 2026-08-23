import { Review } from "../types";
import { supabase } from "../lib/supabase";

const MOCK_REVIEWS: Review[] = [
    {
        id: "r1",
        user: "지현",
        tag: "가족여행",
        score: 5,
        daysAgo: 2,
        text: "일출 정말 좋았어요. 계단이 많아요.",
        helpful: 152,
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
        photo: "https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80",
        type: "가족",
    },
    {
        id: "r2",
        user: "지현",
        tag: "가족여행",
        score: 5,
        daysAgo: 2,
        text: "주차는 이른 시간 추천. 바람 강해요.",
        helpful: 98,
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
        photo: "https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80",
        type: "가족",
    },
    {
        id: "r3",
        user: "민수",
        tag: "혼자여행",
        score: 4,
        daysAgo: 3,
        text: "새벽에 가면 사진이 잘 나와요.",
        helpful: 61,
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
        photo: "https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80",
        type: "혼자",
    },
];

export async function fetchReviews(destinationId?: string): Promise<Review[]> {
    if (supabase) {
        const query = supabase.from("reviews").select("*");
        if (destinationId) {
            query.eq("destinationId", destinationId);
        }
        const { data, error } = await query;
        if (error) {
            console.error("fetchReviews error:", error);
            return MOCK_REVIEWS;
        }
        return data as Review[];
    }
    return Promise.resolve(MOCK_REVIEWS);
}
