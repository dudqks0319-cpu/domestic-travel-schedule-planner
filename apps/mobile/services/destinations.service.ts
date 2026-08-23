import { Destination } from "../types";
import { supabase } from "../lib/supabase";

const MOCK_DESTINATIONS: Destination[] = [
    {
        id: "jeju",
        name: "제주도",
        rating: 4.8,
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80",
    },
    {
        id: "seoul",
        name: "서울",
        rating: 4.9,
        image: "https://images.unsplash.com/photo-1538485399081-7c897b1ca58b?w=1200&auto=format&fit=crop&q=80",
    },
    {
        id: "busan",
        name: "부산",
        rating: 4.7,
        image: "https://images.unsplash.com/photo-1584646098378-0874589d76b1?w=1200&auto=format&fit=crop&q=80",
    },
];

export async function fetchDestinations(): Promise<Destination[]> {
    if (supabase) {
        const { data, error } = await supabase.from("destinations").select("*");
        if (error) {
            console.error("fetchDestinations error:", error);
            return MOCK_DESTINATIONS;
        }
        return data as Destination[];
    }
    return Promise.resolve(MOCK_DESTINATIONS);
}
