import { supabase } from "../lib/supabase";

export const MOCK_STOPS = [
    { id: "s1", time: "09:00", title: "성산일출봉", duration: "2시간", fee: "입장료 5,000원", color: "#F48C7B", image: "https://images.unsplash.com/photo-1573270689103-d7a4e42b6096?w=300&q=80" },
    { id: "s2", time: "11:30", title: "만장굴", duration: "1시간 30분", fee: "입장료 4,000원", color: "#F48C7B", image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=80" },
    { id: "s3", time: "02:30", title: "용두암", duration: "2시간", fee: "입장료 1,000원", color: "#77A8E8", image: "https://images.unsplash.com/photo-1549880181-56a44cf4a9a5?w=300&q=80" },
    { id: "s4", time: "03:30", title: "천지연 폭포", duration: "1시간 30분", fee: "입장료 2,000원", color: "#80D4C8", image: "https://images.unsplash.com/photo-1501556424050-d4816356b73e?w=300&q=80" },
];

export async function fetchTripScheduleStops(tripId?: string) {
    if (supabase) {
        const { data, error } = await supabase.from("trip_places").select(`
      id, startTime, endTime, category, imageUrl,
      name, duration, feeText
    `).order("orderIndex", { ascending: true });

        if (error) {
            console.error("fetchTripScheduleStops error:", error);
            return MOCK_STOPS;
        }

        if (data && data.length > 0) {
            return data.map((item: any) => ({
                id: item.id,
                time: item.startTime || "09:00",
                title: item.name,
                duration: item.duration || "2시간",
                fee: item.feeText || "무료",
                color: item.category === "attraction" ? "#F48C7B" : "#77A8E8",
                image: item.imageUrl || "https://images.unsplash.com/photo-1501556424050-d4816356b73e?w=300&q=80"
            }));
        }
    }
    return Promise.resolve(MOCK_STOPS);
}
