import { Router } from "express";

import { searchAddress } from "../services/address.service";
import { sanitizePublicText } from "../utils/response-safety";

const addressRouter = Router();

addressRouter.get("/search", async (req, res) => {
  try {
    const { keyword, page } = req.query;

    if (!keyword || typeof keyword !== "string" || keyword.trim() === "") {
      return res.status(400).json({ message: "검색어가 필요합니다" });
    }

    const items = await searchAddress(keyword, page ? Number(page) : 1);
    return res.json({ items });
  } catch (error) {
    const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
    console.error(`[address] search failed: ${message || "unknown"}`);
    return res.status(500).json({ message: "주소 검색 중 오류가 발생했습니다" });
  }
});

export { addressRouter };
