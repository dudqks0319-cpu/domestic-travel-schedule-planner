import { Router } from "express";
import { supabase } from "../config/database";

const reviewsRouter = Router();

// GET /reviews — 리뷰 목록 (optional: ?destinationId=xxx&type=가족)
reviewsRouter.get("/", async (req, res) => {
    try {
        let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });

        const destinationId = req.query.destinationId as string | undefined;
        if (destinationId) {
            query = query.eq("destination_id", destinationId);
        }

        const type = req.query.type as string | undefined;
        if (type && type !== "전체") {
            query = query.eq("type", type);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return res.json({ reviews: data || [] });
    } catch (error) {
        console.error("[reviews] list failed:", error);
        return res.status(500).json({ message: "Failed to list reviews" });
    }
});

// POST /reviews — 리뷰 작성
reviewsRouter.post("/", async (req, res) => {
    try {
        const body = req.body as any;

        const { data, error } = await supabase
            .from("reviews")
            .insert({
                user: body.user,
                tag: body.tag,
                score: body.score || 5,
                days_ago: 0,
                text: body.text,
                helpful: 0,
                avatar: body.avatar,
                photo: body.photo || null,
                type: body.type || "전체",
                destination_id: body.destinationId || null,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return res.status(201).json({ review: data });
    } catch (error) {
        console.error("[reviews] create failed:", error);
        return res.status(500).json({ message: "Failed to create review" });
    }
});

export { reviewsRouter };
