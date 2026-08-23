import { Router } from "express";
import {
  searchAttractions,
  searchByKeyword,
  searchFestivals,
  resolveAreaCode
} from "../services/tourism.service";
import { sanitizePublicText } from "../utils/response-safety";
import type { TourItem } from "../services/tourism.service";

const tourismRouter = Router();

function normalizeAreaKeyword(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/(특별시|광역시|특별자치시|자치시|특별자치도|자치도|시|군|구|도)$/g, "")
    .trim()
    .toLowerCase();
}

function filterItemsByArea(items: TourItem[], areaText: string): TourItem[] {
  const keyword = normalizeAreaKeyword(areaText);
  if (!keyword) {
    return items;
  }

  return items.filter((item) => {
    const haystack = `${item.title ?? ""} ${item.addr1 ?? ""} ${item.addr2 ?? ""}`
      .replace(/\s+/g, "")
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

tourismRouter.get("/attractions", async (req, res) => {
  try {
    const { area, contentType, page } = req.query;
    const areaText = typeof area === "string" ? area : "";
    const areaCode = resolveAreaCode(areaText);
    const pageNo = page ? Number(page) : 1;

    const items: TourItem[] =
      areaText && !areaCode
        ? await searchByKeyword(`${areaText} 관광지`, pageNo)
        : await searchAttractions({
            areaCode,
            contentTypeId: contentType as string,
            pageNo
          });

    const filtered = filterItemsByArea(items, areaText);
    if (filtered.length > 0 || !areaText) {
      return res.json({ items: filtered.length > 0 ? filtered : items });
    }

    const fallbackKeywordItems = await searchByKeyword(`${areaText} 관광지`, pageNo);
    return res.json({ items: filterItemsByArea(fallbackKeywordItems, areaText) });
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
    const areaText = typeof area === "string" ? area : "";
    const areaCode = resolveAreaCode(areaText || undefined);
    const items = await searchFestivals({
      eventStartDate: startDate as string,
      areaCode,
      pageNo: page ? Number(page) : 1
    });

    const filtered = filterItemsByArea(items, areaText);
    return res.json({ items: filtered.length > 0 ? filtered : items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[tourism] festival lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "축제 검색 중 오류가 발생했습니다" });
  }
});

export { tourismRouter };
