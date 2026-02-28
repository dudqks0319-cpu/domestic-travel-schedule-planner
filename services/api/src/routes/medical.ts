import { Router } from "express";
import { searchHospitals, searchPharmacies } from "../services/medical.service";
import { sanitizePublicText } from "../utils/response-safety";

const medicalRouter = Router();

medicalRouter.get("/hospitals", async (req, res) => {
  try {
    const { lat, lng, page } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: "lat, lng가 필요합니다" });

    const items = await searchHospitals({
      lat: Number(lat),
      lng: Number(lng),
      pageNo: page ? Number(page) : 1
    });
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[medical] hospital search failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "병원 검색 중 오류가 발생했습니다" });
  }
});

medicalRouter.get("/pharmacies", async (req, res) => {
  try {
    const { lat, lng, page } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: "lat, lng가 필요합니다" });

    const items = await searchPharmacies({
      lat: Number(lat),
      lng: Number(lng),
      pageNo: page ? Number(page) : 1
    });
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[medical] pharmacy search failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "약국 검색 중 오류가 발생했습니다" });
  }
});

export { medicalRouter };
