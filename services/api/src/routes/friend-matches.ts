import { Router } from "express";
import { supabase } from "../config/database";

const friendMatchesRouter = Router();

// GET /friend-matches — 여행 친구 매칭 목록
friendMatchesRouter.get("/", async (req, res) => {
    try {
        const sort = req.query.sort as string | undefined;
        let query = supabase.from("friend_matches").select("*");

        if (sort === "high") {
            query = query.order("match", { ascending: false });
        } else {
            query = query.order("created_at", { ascending: false });
        }

        const destination = req.query.destination as string | undefined;
        if (destination) {
            query = query.ilike("destination", `%${destination}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return res.json({ friendMatches: data || [] });
    } catch (error) {
        console.error("[friend-matches] list failed:", error);
        return res.status(500).json({ message: "Failed to list friend matches" });
    }
});

// POST /friend-matches — 매칭 프로필 등록
friendMatchesRouter.post("/", async (req, res) => {
    try {
        const body = req.body as any;

        const { data, error } = await supabase
            .from("friend_matches")
            .insert({
                name: body.name,
                age: body.age,
                destination: body.destination,
                date_range: body.dateRange,
                bio: body.bio,
                match: body.match || 0,
                avatar: body.avatar,
                tags: body.tags || [],
                checklist: body.checklist || [],
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return res.status(201).json({ friendMatch: data });
    } catch (error) {
        console.error("[friend-matches] create failed:", error);
        return res.status(500).json({ message: "Failed to create friend match" });
    }
});

export { friendMatchesRouter };
