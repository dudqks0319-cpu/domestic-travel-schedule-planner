import type { Destination } from "../types";

const DESTINATIONS: Destination[] = [
  {
    id: "jeju",
    name: "제주",
    image: "https://images.unsplash.com/photo-1609236086450-2f2f16d7c3f5?auto=format&fit=crop&w=1200&q=80",
    rating: 4.9
  },
  {
    id: "busan",
    name: "부산",
    image: "https://images.unsplash.com/photo-1570521462033-3015e76e7432?auto=format&fit=crop&w=1200&q=80",
    rating: 4.8
  },
  {
    id: "gangneung",
    name: "강릉",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    rating: 4.7
  }
];

export async function fetchDestinations(): Promise<Destination[]> {
  return DESTINATIONS;
}
