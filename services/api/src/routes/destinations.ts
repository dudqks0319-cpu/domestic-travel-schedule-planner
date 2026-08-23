import { Router } from "express";
import { supabase } from "../config/database";

const destinationsRouter = Router();

// GET /destinations — 인기 여행지 목록
destinationsRouter.get("/", async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from("destinations")
            .select("*")
            .order("rating", { ascending: false });

        if (error) throw new Error(error.message);
        return res.json({ destinations: data || [] });
    } catch (error) {
        console.error("[destinations] list failed:", error);
        return res.status(500).json({ message: "Failed to list destinations" });
    }
});

// GET /destinations/:id — 여행지 상세
destinationsRouter.get("/:id", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("destinations")
            .select("*")
            .eq("id", req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ message: "Destination not found" });
        }

        return res.json({ destination: data });
    } catch (error) {
        console.error("[destinations] get failed:", error);
        return res.status(500).json({ message: "Failed to get destination" });
    }
});

export { destinationsRouter };
