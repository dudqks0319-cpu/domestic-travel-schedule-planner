import { Router } from "express";
import { searchRestaurants } from "../services/restaurant.service";
import { sanitizePublicText } from "../utils/response-safety";

const restaurantsRouter = Router();

restaurantsRouter.get("/search", async (req, res) => {
  try {
    const { query, display, start, sort } = req.query;
    if (!query) return res.status(400).json({ message: "검색어가 필요합니다" });

    const items = await searchRestaurants({
      query: query as string,
      display: display ? Number(display) : undefined,
      start: start ? Number(start) : undefined,
      sort: sort as "random" | "comment" | undefined
    });

    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[restaurants] search failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "맛집 검색 중 오류가 발생했습니다" });
  }
});

export { restaurantsRouter };
