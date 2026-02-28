import { Router } from "express";
import { searchAttractions, searchByKeyword, searchFestivals, AREA_CODES } from "../services/tourism.service";
import { sanitizePublicText } from "../utils/response-safety";

const tourismRouter = Router();

tourismRouter.get("/attractions", async (req, res) => {
  try {
    const { area, contentType, page } = req.query;
    const areaCode = AREA_CODES[area as string] ?? "1";
    const items = await searchAttractions({
      areaCode,
      contentTypeId: contentType as string,
      pageNo: page ? Number(page) : 1
    });
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[tourism] attractions lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "관광지 검색 중 오류가 발생했습니다" });
  }
});

tourismRouter.get("/search", async (req, res) => {
  try {
    const { keyword, page } = req.query;
    if (!keyword) return res.status(400).json({ message: "검색어가 필요합니다" });
    const items = await searchByKeyword(keyword as string, page ? Number(page) : 1);
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[tourism] keyword lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "검색 중 오류가 발생했습니다" });
  }
});

tourismRouter.get("/festivals", async (req, res) => {
  try {
    const { startDate, area, page } = req.query;
    if (!startDate) return res.status(400).json({ message: "시작일이 필요합니다" });
    const areaCode = area ? AREA_CODES[area as string] : undefined;
    const items = await searchFestivals({
      eventStartDate: startDate as string,
      areaCode,
      pageNo: page ? Number(page) : 1
    });
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[tourism] festival lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "축제 검색 중 오류가 발생했습니다" });
  }
});

export { tourismRouter };
