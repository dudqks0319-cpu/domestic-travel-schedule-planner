import { Router } from "express";
import { getShortTermForecast, toGridCoord, POPULAR_GRIDS } from "../services/weather.service";
import { getAirQuality, gradeToText } from "../services/air-quality.service";
import { sanitizePublicText } from "../utils/response-safety";

const weatherRouter = Router();

weatherRouter.get("/forecast", async (req, res) => {
  try {
    const { lat, lng, city, baseDate, baseTime } = req.query;

    let nx: number;
    let ny: number;

    if (city && POPULAR_GRIDS[city as string]) {
      ({ nx, ny } = POPULAR_GRIDS[city as string]);
    } else if (lat && lng) {
      ({ nx, ny } = toGridCoord(Number(lat), Number(lng)));
    } else {
      return res.status(400).json({ message: "city 또는 lat/lng가 필요합니다" });
    }

    const now = new Date();
    const date = (baseDate as string) ?? now.toISOString().slice(0, 10).replace(/-/g, "");
    const time = (baseTime as string) ?? "0500";

    const items = await getShortTermForecast({ nx, ny, baseDate: date, baseTime: time });
    return res.json({ items, grid: { nx, ny } });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[weather] forecast lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "날씨 정보 조회 중 오류가 발생했습니다" });
  }
});

weatherRouter.get("/air", async (req, res) => {
  try {
    const { sido } = req.query;
    if (!sido) return res.status(400).json({ message: "시도명이 필요합니다 (예: 서울, 부산)" });
    const items = await getAirQuality(sido as string);
    return res.json({
      items: Array.isArray(items)
        ? items.map((item) => ({
            ...item,
            pm10GradeText: gradeToText(item.pm10Grade),
            pm25GradeText: gradeToText(item.pm25Grade)
          }))
        : []
    });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[weather] air-quality lookup failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "대기질 정보 조회 중 오류가 발생했습니다" });
  }
});

export { weatherRouter };
