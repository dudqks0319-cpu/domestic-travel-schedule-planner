import { Router, type Response } from "express";

import { supabase } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { sanitizePublicText } from "../utils/response-safety";

const tripsRouter = Router();

// ── helpers ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendValidationError(res: Response, errors: string[]) {
  return res.status(400).json({ message: "Validation failed", errors });
}

function logInternalError(scope: string, error: unknown) {
  const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
  console.error(`[trips] ${scope} failed: ${message || "unknown"}`);
}

// ── auth guard ──
tripsRouter.use(authMiddleware);

// ── GET /trips ──
tripsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const { data: trips, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Fetch days + places for each trip
    const tripsWithDetails = await Promise.all(
      (trips || []).map(async (trip: any) => {
        const { data: days } = await supabase
          .from("trip_days")
          .select("*")
          .eq("trip_id", trip.id)
          .order("day_number", { ascending: true });

        const daysWithPlaces = await Promise.all(
          (days || []).map(async (day: any) => {
            const { data: places } = await supabase
              .from("trip_places")
              .select("*")
              .eq("trip_day_id", day.id)
              .order("order_index", { ascending: true });
            return { ...day, places: places || [] };
          })
        );

        return { ...trip, days: daysWithPlaces };
      })
    );

    return res.json({ trips: tripsWithDetails });
  } catch (error) {
    logInternalError("list trips", error);
    return res.status(500).json({ message: "Failed to list trips" });
  }
});

// ── POST /trips ──
tripsRouter.post("/", async (req, res) => {
  try {
    const body = req.body as any;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    if (!body.title || typeof body.title !== "string") errors.push("title is required");
    if (!body.destination || typeof body.destination !== "string") errors.push("destination is required");
    if (!body.startDate) errors.push("startDate is required");
    if (!body.endDate) errors.push("endDate is required");

    if (errors.length > 0) return sendValidationError(res, errors);

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        title: body.title,
        destination: body.destination,
        start_date: new Date(String(body.startDate)).toISOString(),
        end_date: new Date(String(body.endDate)).toISOString(),
        transport: body.transport || null,
        companions: body.companions || null,
        status: body.status || "draft",
        user_id: req.user!.userId,
      })
      .select()
      .single();

    if (tripError) throw new Error(tripError.message);

    // Create days if provided
    if (Array.isArray(body.days)) {
      for (const dayInput of body.days) {
        const { data: day, error: dayError } = await supabase
          .from("trip_days")
          .insert({
            trip_id: trip.id,
            day_number: dayInput.dayNumber,
            date: new Date(String(dayInput.date)).toISOString(),
          })
          .select()
          .single();

        if (dayError) throw new Error(dayError.message);

        if (Array.isArray(dayInput.places)) {
          for (const placeInput of dayInput.places) {
            await supabase.from("trip_places").insert({
              trip_day_id: day.id,
              order_index: placeInput.orderIndex,
              name: placeInput.name,
              category: placeInput.category,
              address: placeInput.address || null,
              lat: placeInput.lat || null,
              lng: placeInput.lng || null,
              image_url: placeInput.imageUrl || null,
              phone: placeInput.phone || null,
              memo: placeInput.memo || null,
              start_time: placeInput.startTime || null,
              end_time: placeInput.endTime || null,
            });
          }
        }
      }
    }

    return res.status(201).json({ trip });
  } catch (error) {
    logInternalError("create trip", error);
    return res.status(500).json({ message: "Failed to create trip" });
  }
});

// ── GET /trips/:tripId ──
tripsRouter.get("/:tripId", async (req, res) => {
  try {
    const tripId = req.params.tripId;

    const { data: trip, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (error || !trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Fetch days + places
    const { data: days } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    const daysWithPlaces = await Promise.all(
      (days || []).map(async (day: any) => {
        const { data: places } = await supabase
          .from("trip_places")
          .select("*")
          .eq("trip_day_id", day.id)
          .order("order_index", { ascending: true });
        return { ...day, places: places || [] };
      })
    );

    return res.json({ trip: { ...trip, days: daysWithPlaces } });
  } catch (error) {
    logInternalError("get trip detail", error);
    return res.status(500).json({ message: "Failed to get trip" });
  }
});

// ── PATCH /trips/:tripId ──
tripsRouter.patch("/:tripId", async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const body = req.body as any;

    // Verify ownership
    const { data: existing } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title) updateData.title = body.title;
    if (body.destination) updateData.destination = body.destination;
    if (body.startDate) updateData.start_date = new Date(body.startDate).toISOString();
    if (body.endDate) updateData.end_date = new Date(body.endDate).toISOString();
    if (body.transport !== undefined) updateData.transport = body.transport;
    if (body.companions !== undefined) updateData.companions = body.companions;
    if (body.status) updateData.status = body.status;

    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, ["At least one updatable field is required"]);
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .update(updateData)
      .eq("id", tripId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.json({ trip });
  } catch (error) {
    logInternalError("update trip", error);
    return res.status(500).json({ message: "Failed to update trip" });
  }
});

// ── DELETE /trips/:tripId ──
tripsRouter.delete("/:tripId", async (req, res) => {
  try {
    const tripId = req.params.tripId;

    const { data: existing } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    if (error) throw new Error(error.message);

    return res.status(204).send();
  } catch (error) {
    logInternalError("delete trip", error);
    return res.status(500).json({ message: "Failed to delete trip" });
  }
});

// ── GET /trips/:tripId/days ──
tripsRouter.get("/:tripId/days", async (req, res) => {
  try {
    const tripId = req.params.tripId;

    // Verify ownership
    const { data: existing } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const { data: days, error } = await supabase
      .from("trip_days")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_number", { ascending: true });

    if (error) throw new Error(error.message);

    const daysWithPlaces = await Promise.all(
      (days || []).map(async (day: any) => {
        const { data: places } = await supabase
          .from("trip_places")
          .select("*")
          .eq("trip_day_id", day.id)
          .order("order_index", { ascending: true });
        return { ...day, places: places || [] };
      })
    );

    return res.json({ days: daysWithPlaces });
  } catch (error) {
    logInternalError("list days", error);
    return res.status(500).json({ message: "Failed to list trip days" });
  }
});

// ── POST /trips/:tripId/days ──
tripsRouter.post("/:tripId/days", async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const body = req.body as any;

    // Verify ownership
    const { data: existing } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!existing) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const errors: string[] = [];
    if (!body.dayNumber || typeof body.dayNumber !== "number") errors.push("dayNumber is required");
    if (!body.date) errors.push("date is required");
    if (errors.length > 0) return sendValidationError(res, errors);

    const { data: day, error: dayError } = await supabase
      .from("trip_days")
      .insert({
        trip_id: tripId,
        day_number: body.dayNumber,
        date: new Date(body.date).toISOString(),
      })
      .select()
      .single();

    if (dayError) throw new Error(dayError.message);

    // Create places if provided
    if (Array.isArray(body.places)) {
      for (const placeInput of body.places) {
        await supabase.from("trip_places").insert({
          trip_day_id: day.id,
          order_index: placeInput.orderIndex,
          name: placeInput.name,
          category: placeInput.category,
          address: placeInput.address || null,
          lat: placeInput.lat || null,
          lng: placeInput.lng || null,
          image_url: placeInput.imageUrl || null,
          phone: placeInput.phone || null,
          memo: placeInput.memo || null,
          start_time: placeInput.startTime || null,
          end_time: placeInput.endTime || null,
        });
      }
    }

    return res.status(201).json({ day });
  } catch (error) {
    logInternalError("create day", error);
    return res.status(500).json({ message: "Failed to create trip day" });
  }
});

// ── PATCH /trips/:tripId/days/:dayId ──
tripsRouter.patch("/:tripId/days/:dayId", async (req, res) => {
  try {
    const { tripId, dayId } = req.params;
    const body = req.body as any;

    // Verify ownership
    const { data: tripExists } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days")
      .select("id")
      .eq("id", dayId)
      .eq("trip_id", tripId)
      .single();

    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const updateData: Record<string, unknown> = {};
    if (body.dayNumber !== undefined) updateData.day_number = body.dayNumber;
    if (body.date !== undefined) updateData.date = new Date(body.date).toISOString();

    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, ["At least one updatable field is required"]);
    }

    const { data: day, error } = await supabase
      .from("trip_days")
      .update(updateData)
      .eq("id", dayId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.json({ day });
  } catch (error) {
    logInternalError("update day", error);
    return res.status(500).json({ message: "Failed to update trip day" });
  }
});

// ── DELETE /trips/:tripId/days/:dayId ──
tripsRouter.delete("/:tripId/days/:dayId", async (req, res) => {
  try {
    const { tripId, dayId } = req.params;

    const { data: tripExists } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days")
      .select("id")
      .eq("id", dayId)
      .eq("trip_id", tripId)
      .single();

    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const { error } = await supabase.from("trip_days").delete().eq("id", dayId);
    if (error) throw new Error(error.message);

    return res.status(204).send();
  } catch (error) {
    logInternalError("delete day", error);
    return res.status(500).json({ message: "Failed to delete trip day" });
  }
});

// ── GET /trips/:tripId/days/:dayId/places ──
tripsRouter.get("/:tripId/days/:dayId/places", async (req, res) => {
  try {
    const { tripId, dayId } = req.params;

    const { data: tripExists } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days")
      .select("id")
      .eq("id", dayId)
      .eq("trip_id", tripId)
      .single();

    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const { data: places, error } = await supabase
      .from("trip_places")
      .select("*")
      .eq("trip_day_id", dayId)
      .order("order_index", { ascending: true });

    if (error) throw new Error(error.message);
    return res.json({ places: places || [] });
  } catch (error) {
    logInternalError("list places", error);
    return res.status(500).json({ message: "Failed to list places" });
  }
});

// ── POST /trips/:tripId/days/:dayId/places ──
tripsRouter.post("/:tripId/days/:dayId/places", async (req, res) => {
  try {
    const { tripId, dayId } = req.params;
    const body = req.body as any;

    const { data: tripExists } = await supabase
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("user_id", req.user!.userId)
      .single();

    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days")
      .select("id")
      .eq("id", dayId)
      .eq("trip_id", tripId)
      .single();

    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const errors: string[] = [];
    if (body.orderIndex === undefined) errors.push("orderIndex is required");
    if (!body.name) errors.push("name is required");
    if (!body.category) errors.push("category is required");
    if (errors.length > 0) return sendValidationError(res, errors);

    const { data: place, error } = await supabase
      .from("trip_places")
      .insert({
        trip_day_id: dayId,
        order_index: body.orderIndex,
        name: body.name,
        category: body.category,
        address: body.address || null,
        lat: body.lat || null,
        lng: body.lng || null,
        image_url: body.imageUrl || null,
        phone: body.phone || null,
        memo: body.memo || null,
        start_time: body.startTime || null,
        end_time: body.endTime || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.status(201).json({ place });
  } catch (error) {
    logInternalError("create place", error);
    return res.status(500).json({ message: "Failed to create place" });
  }
});

// ── PATCH /trips/:tripId/days/:dayId/places/:placeId ──
tripsRouter.patch("/:tripId/days/:dayId/places/:placeId", async (req, res) => {
  try {
    const { tripId, dayId, placeId } = req.params;
    const body = req.body as any;

    const { data: tripExists } = await supabase
      .from("trips").select("id")
      .eq("id", tripId).eq("user_id", req.user!.userId).single();
    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days").select("id")
      .eq("id", dayId).eq("trip_id", tripId).single();
    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const { data: placeExists } = await supabase
      .from("trip_places").select("id")
      .eq("id", placeId).eq("trip_day_id", dayId).single();
    if (!placeExists) return res.status(404).json({ message: "Place not found" });

    const updateData: Record<string, unknown> = {};
    if (body.orderIndex !== undefined) updateData.order_index = body.orderIndex;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.lat !== undefined) updateData.lat = body.lat;
    if (body.lng !== undefined) updateData.lng = body.lng;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.memo !== undefined) updateData.memo = body.memo;
    if (body.startTime !== undefined) updateData.start_time = body.startTime;
    if (body.endTime !== undefined) updateData.end_time = body.endTime;

    if (Object.keys(updateData).length === 0) {
      return sendValidationError(res, ["At least one updatable field is required"]);
    }

    const { data: place, error } = await supabase
      .from("trip_places")
      .update(updateData)
      .eq("id", placeId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.json({ place });
  } catch (error) {
    logInternalError("update place", error);
    return res.status(500).json({ message: "Failed to update place" });
  }
});

// ── DELETE /trips/:tripId/days/:dayId/places/:placeId ──
tripsRouter.delete("/:tripId/days/:dayId/places/:placeId", async (req, res) => {
  try {
    const { tripId, dayId, placeId } = req.params;

    const { data: tripExists } = await supabase
      .from("trips").select("id")
      .eq("id", tripId).eq("user_id", req.user!.userId).single();
    if (!tripExists) return res.status(404).json({ message: "Trip not found" });

    const { data: dayExists } = await supabase
      .from("trip_days").select("id")
      .eq("id", dayId).eq("trip_id", tripId).single();
    if (!dayExists) return res.status(404).json({ message: "Day not found" });

    const { data: placeExists } = await supabase
      .from("trip_places").select("id")
      .eq("id", placeId).eq("trip_day_id", dayId).single();
    if (!placeExists) return res.status(404).json({ message: "Place not found" });

    const { error } = await supabase.from("trip_places").delete().eq("id", placeId);
    if (error) throw new Error(error.message);

    return res.status(204).send();
  } catch (error) {
    logInternalError("delete place", error);
    return res.status(500).json({ message: "Failed to delete place" });
  }
});

// ── Scaffold routes (not yet implemented) ──
tripsRouter.get("/:tripId/flights", (_req, res) => {
  res.status(501).json({ message: "Trip flights list scaffold - not implemented" });
});

tripsRouter.post("/:tripId/flights", (_req, res) => {
  res.status(501).json({ message: "Trip flights create scaffold - not implemented" });
});

tripsRouter.get("/:tripId/rentcars", (_req, res) => {
  res.status(501).json({ message: "Trip rentcars list scaffold - not implemented" });
});

tripsRouter.post("/:tripId/rentcars", (_req, res) => {
  res.status(501).json({ message: "Trip rentcars create scaffold - not implemented" });
});

tripsRouter.get("/:tripId/restaurants", (_req, res) => {
  res.status(501).json({ message: "Trip restaurants list scaffold - not implemented" });
});

tripsRouter.post("/:tripId/restaurants", (_req, res) => {
  res.status(501).json({ message: "Trip restaurants create scaffold - not implemented" });
});

tripsRouter.get("/:tripId/parking", (_req, res) => {
  res.status(501).json({ message: "Trip parking list scaffold - not implemented" });
});

tripsRouter.post("/:tripId/parking", (_req, res) => {
  res.status(501).json({ message: "Trip parking create scaffold - not implemented" });
});

export { tripsRouter };
