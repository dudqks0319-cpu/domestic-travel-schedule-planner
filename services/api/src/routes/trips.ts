import { Router, type Response } from "express";

import { prisma } from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { sanitizePublicText } from "../utils/response-safety";

const tripsRouter = Router();

const tripDetailsInclude = {
  days: {
    orderBy: { dayNumber: "asc" as const },
    include: {
      places: {
        orderBy: { orderIndex: "asc" as const }
      }
    }
  }
};

const dayDetailsInclude = {
  places: {
    orderBy: { orderIndex: "asc" as const }
  }
};

const tripCreateFields = new Set([
  "title",
  "destination",
  "startDate",
  "endDate",
  "transport",
  "companions",
  "status",
  "days"
]);
const tripUpdateFields = new Set([
  "title",
  "destination",
  "startDate",
  "endDate",
  "transport",
  "companions",
  "status"
]);
const dayCreateFields = new Set(["dayNumber", "date", "places"]);
const dayUpdateFields = new Set(["dayNumber", "date"]);
const placeFields = new Set([
  "orderIndex",
  "name",
  "address",
  "lat",
  "lng",
  "category",
  "imageUrl",
  "phone",
  "memo",
  "startTime",
  "endTime"
]);

interface ParsedPlaceInput {
  orderIndex: number;
  name: string;
  category: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  phone?: string | null;
  memo?: string | null;
  startTime?: string | null;
  endTime?: string | null;
}

interface ParsedDayInput {
  dayNumber: number;
  date: Date;
  places?: ParsedPlaceInput[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendValidationError(res: Response, errors: string[]) {
  return res.status(400).json({
    message: "Validation failed",
    errors
  });
}

function addUnknownFieldError(
  body: Record<string, unknown>,
  allowedFields: Set<string>,
  errors: string[],
  label: string
) {
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    errors.push(`${label} contains unknown fields: ${unknownFields.join(", ")}`);
  }
}

function parseRequiredNonEmptyString(
  value: unknown,
  field: string,
  errors: string[]
): string | null {
  if (typeof value !== "string") {
    errors.push(`${field} is required and must be a string`);
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} is required and must not be empty`);
    return null;
  }

  return trimmed;
}

function parseOptionalNonEmptyString(
  value: unknown,
  field: string,
  errors: string[]
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} must not be empty`);
    return undefined;
  }

  return trimmed;
}

function parseOptionalNullableNonEmptyString(
  value: unknown,
  field: string,
  errors: string[]
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    errors.push(`${field} must be a string or null`);
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    errors.push(`${field} must not be empty`);
    return undefined;
  }

  return trimmed;
}

function parseRequiredDate(value: unknown, field: string, errors: string[]): Date | null {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} is required and must be a valid date string`);
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be a valid date string`);
    return null;
  }

  return parsed;
}

function parseOptionalDate(value: unknown, field: string, errors: string[]): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} must be a valid date string`);
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${field} must be a valid date string`);
    return undefined;
  }

  return parsed;
}

function parseRequiredInteger(value: unknown, field: string, errors: string[]): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${field} is required and must be an integer`);
    return null;
  }

  return value;
}

function parseOptionalInteger(value: unknown, field: string, errors: string[]): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return undefined;
  }

  return value;
}

function parseOptionalNullableNumber(
  value: unknown,
  field: string,
  errors: string[]
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field} must be a finite number or null`);
    return undefined;
  }

  return value;
}

function parseRequiredParam(value: string | undefined, name: string): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  return value.trim();
}

function toPlaceCreateData(place: ParsedPlaceInput) {
  return {
    orderIndex: place.orderIndex,
    name: place.name,
    category: place.category,
    ...(place.address !== undefined ? { address: place.address } : {}),
    ...(place.lat !== undefined ? { lat: place.lat } : {}),
    ...(place.lng !== undefined ? { lng: place.lng } : {}),
    ...(place.imageUrl !== undefined ? { imageUrl: place.imageUrl } : {}),
    ...(place.phone !== undefined ? { phone: place.phone } : {}),
    ...(place.memo !== undefined ? { memo: place.memo } : {}),
    ...(place.startTime !== undefined ? { startTime: place.startTime } : {}),
    ...(place.endTime !== undefined ? { endTime: place.endTime } : {})
  };
}

function parsePlaceCreateInput(
  value: unknown,
  path: string,
  errors: string[]
): ParsedPlaceInput | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  addUnknownFieldError(value, placeFields, errors, path);

  const orderIndex = parseRequiredInteger(value.orderIndex, `${path}.orderIndex`, errors);
  const name = parseRequiredNonEmptyString(value.name, `${path}.name`, errors);
  const category = parseRequiredNonEmptyString(value.category, `${path}.category`, errors);
  const address = parseOptionalNullableNonEmptyString(value.address, `${path}.address`, errors);
  const lat = parseOptionalNullableNumber(value.lat, `${path}.lat`, errors);
  const lng = parseOptionalNullableNumber(value.lng, `${path}.lng`, errors);
  const imageUrl = parseOptionalNullableNonEmptyString(value.imageUrl, `${path}.imageUrl`, errors);
  const phone = parseOptionalNullableNonEmptyString(value.phone, `${path}.phone`, errors);
  const memo = parseOptionalNullableNonEmptyString(value.memo, `${path}.memo`, errors);
  const startTime = parseOptionalNullableNonEmptyString(value.startTime, `${path}.startTime`, errors);
  const endTime = parseOptionalNullableNonEmptyString(value.endTime, `${path}.endTime`, errors);

  if (orderIndex === null || name === null || category === null) {
    return null;
  }

  if (orderIndex < 0) {
    errors.push(`${path}.orderIndex must be greater than or equal to 0`);
  }

  const parsed: ParsedPlaceInput = {
    orderIndex,
    name,
    category
  };

  if (address !== undefined) parsed.address = address;
  if (lat !== undefined) parsed.lat = lat;
  if (lng !== undefined) parsed.lng = lng;
  if (imageUrl !== undefined) parsed.imageUrl = imageUrl;
  if (phone !== undefined) parsed.phone = phone;
  if (memo !== undefined) parsed.memo = memo;
  if (startTime !== undefined) parsed.startTime = startTime;
  if (endTime !== undefined) parsed.endTime = endTime;

  return parsed;
}

function parseDayCreateInput(value: unknown, path: string, errors: string[]): ParsedDayInput | null {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return null;
  }

  addUnknownFieldError(value, dayCreateFields, errors, path);

  const dayNumber = parseRequiredInteger(value.dayNumber, `${path}.dayNumber`, errors);
  const date = parseRequiredDate(value.date, `${path}.date`, errors);

  if (dayNumber === null || date === null) {
    return null;
  }

  if (dayNumber < 1) {
    errors.push(`${path}.dayNumber must be greater than or equal to 1`);
  }

  let places: ParsedPlaceInput[] | undefined;
  if ("places" in value) {
    if (!Array.isArray(value.places)) {
      errors.push(`${path}.places must be an array`);
    } else {
      places = [];
      value.places.forEach((placeValue, index) => {
        const parsedPlace = parsePlaceCreateInput(placeValue, `${path}.places[${index}]`, errors);
        if (parsedPlace) {
          places!.push(parsedPlace);
        }
      });
    }
  }

  const parsed: ParsedDayInput = {
    dayNumber,
    date
  };

  if (places !== undefined) {
    parsed.places = places;
  }

  return parsed;
}

function logInternalError(scope: string, error: unknown) {
  const message = error instanceof Error ? sanitizePublicText(error.message) : "unknown";
  console.error(`[trips] ${scope} failed: ${message || "unknown"}`);
}

async function findOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
    select: {
      id: true,
      startDate: true,
      endDate: true
    }
  });
}

async function findDayInTrip(tripId: string, dayId: string) {
  return prisma.tripDay.findFirst({
    where: { id: dayId, tripId },
    select: { id: true }
  });
}

async function findPlaceInDay(dayId: string, placeId: string) {
  return prisma.tripPlace.findFirst({
    where: { id: placeId, tripDayId: dayId },
    select: { id: true }
  });
}

tripsRouter.use(authMiddleware);

tripsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const trips = await prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: tripDetailsInclude
    });

    return res.json({ trips });
  } catch (error) {
    logInternalError("list trips", error);
    return res.status(500).json({ message: "Failed to list trips" });
  }
});

tripsRouter.post("/", async (req, res) => {
  try {
    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    addUnknownFieldError(body, tripCreateFields, errors, "Request body");

    const title = parseRequiredNonEmptyString(body.title, "title", errors);
    const destination = parseRequiredNonEmptyString(body.destination, "destination", errors);
    const startDate = parseRequiredDate(body.startDate, "startDate", errors);
    const endDate = parseRequiredDate(body.endDate, "endDate", errors);
    const transport = parseOptionalNullableNonEmptyString(body.transport, "transport", errors);
    const companions = parseOptionalNullableNonEmptyString(body.companions, "companions", errors);
    const status = parseOptionalNonEmptyString(body.status, "status", errors);

    let days: ParsedDayInput[] | undefined;
    if ("days" in body) {
      if (!Array.isArray(body.days)) {
        errors.push("days must be an array");
      } else {
        days = [];
        body.days.forEach((dayValue, index) => {
          const parsedDay = parseDayCreateInput(dayValue, `days[${index}]`, errors);
          if (parsedDay) {
            days!.push(parsedDay);
          }
        });
      }
    }

    if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
      errors.push("startDate must be before or equal to endDate");
    }

    if (errors.length > 0 || !title || !destination || !startDate || !endDate) {
      return sendValidationError(res, errors);
    }

    const trip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate,
        endDate,
        status: status ?? "draft",
        userId: req.user!.userId,
        ...(transport !== undefined ? { transport } : {}),
        ...(companions !== undefined ? { companions } : {}),
        ...(days !== undefined
          ? {
              days: {
                create: days.map((day) => ({
                  dayNumber: day.dayNumber,
                  date: day.date,
                  ...(day.places !== undefined
                    ? {
                        places: {
                          create: day.places.map((place) => toPlaceCreateData(place))
                        }
                      }
                    : {})
                }))
              }
            }
          : {})
      },
      include: tripDetailsInclude
    });

    return res.status(201).json({ trip });
  } catch (error) {
    logInternalError("create trip", error);
    return res.status(500).json({ message: "Failed to create trip" });
  }
});

tripsRouter.get("/:tripId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user!.userId
      },
      include: tripDetailsInclude
    });

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    return res.json({ trip });
  } catch (error) {
    logInternalError("get trip detail", error);
    return res.status(500).json({ message: "Failed to get trip" });
  }
});

tripsRouter.patch("/:tripId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    addUnknownFieldError(body, tripUpdateFields, errors, "Request body");

    const data: {
      title?: string;
      destination?: string;
      startDate?: Date;
      endDate?: Date;
      transport?: string | null;
      companions?: string | null;
      status?: string;
    } = {};

    if ("title" in body) {
      const title = parseRequiredNonEmptyString(body.title, "title", errors);
      if (title) data.title = title;
    }

    if ("destination" in body) {
      const destination = parseRequiredNonEmptyString(body.destination, "destination", errors);
      if (destination) data.destination = destination;
    }

    if ("startDate" in body) {
      const startDate = parseOptionalDate(body.startDate, "startDate", errors);
      if (startDate) data.startDate = startDate;
    }

    if ("endDate" in body) {
      const endDate = parseOptionalDate(body.endDate, "endDate", errors);
      if (endDate) data.endDate = endDate;
    }

    if ("transport" in body) {
      const transport = parseOptionalNullableNonEmptyString(body.transport, "transport", errors);
      if (transport !== undefined) data.transport = transport;
    }

    if ("companions" in body) {
      const companions = parseOptionalNullableNonEmptyString(body.companions, "companions", errors);
      if (companions !== undefined) data.companions = companions;
    }

    if ("status" in body) {
      const status = parseOptionalNonEmptyString(body.status, "status", errors);
      if (status !== undefined) data.status = status;
    }

    if (Object.keys(data).length === 0 && errors.length === 0) {
      errors.push("At least one updatable field is required");
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const existingTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!existingTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const nextStartDate = data.startDate ?? existingTrip.startDate;
    const nextEndDate = data.endDate ?? existingTrip.endDate;
    if (nextStartDate.getTime() > nextEndDate.getTime()) {
      return sendValidationError(res, ["startDate must be before or equal to endDate"]);
    }

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data,
      include: tripDetailsInclude
    });

    return res.json({ trip });
  } catch (error) {
    logInternalError("update trip", error);
    return res.status(500).json({ message: "Failed to update trip" });
  }
});

tripsRouter.delete("/:tripId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    await prisma.trip.delete({ where: { id: tripId } });
    return res.status(204).send();
  } catch (error) {
    logInternalError("delete trip", error);
    return res.status(500).json({ message: "Failed to delete trip" });
  }
});

tripsRouter.get("/:tripId/days", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const days = await prisma.tripDay.findMany({
      where: { tripId },
      orderBy: { dayNumber: "asc" },
      include: dayDetailsInclude
    });

    return res.json({ days });
  } catch (error) {
    logInternalError("list days", error);
    return res.status(500).json({ message: "Failed to list trip days" });
  }
});

tripsRouter.post("/:tripId/days", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    addUnknownFieldError(body, dayCreateFields, errors, "Request body");

    const dayNumber = parseRequiredInteger(body.dayNumber, "dayNumber", errors);
    const date = parseRequiredDate(body.date, "date", errors);

    if (dayNumber !== null && dayNumber < 1) {
      errors.push("dayNumber must be greater than or equal to 1");
    }

    let places: ParsedPlaceInput[] | undefined;
    if ("places" in body) {
      if (!Array.isArray(body.places)) {
        errors.push("places must be an array");
      } else {
        places = [];
        body.places.forEach((placeValue, index) => {
          const parsedPlace = parsePlaceCreateInput(placeValue, `places[${index}]`, errors);
          if (parsedPlace) {
            places!.push(parsedPlace);
          }
        });
      }
    }

    if (errors.length > 0 || dayNumber === null || date === null) {
      return sendValidationError(res, errors);
    }

    const day = await prisma.tripDay.create({
      data: {
        tripId,
        dayNumber,
        date,
        ...(places !== undefined
          ? {
              places: {
                create: places.map((place) => toPlaceCreateData(place))
              }
            }
          : {})
      },
      include: dayDetailsInclude
    });

    return res.status(201).json({ day });
  } catch (error) {
    logInternalError("create day", error);
    return res.status(500).json({ message: "Failed to create trip day" });
  }
});

tripsRouter.get("/:tripId/days/:dayId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const day = await prisma.tripDay.findFirst({
      where: { id: dayId, tripId },
      include: dayDetailsInclude
    });
    if (!day) {
      return res.status(404).json({ message: "Day not found" });
    }

    return res.json({ day });
  } catch (error) {
    logInternalError("get day detail", error);
    return res.status(500).json({ message: "Failed to get trip day" });
  }
});

tripsRouter.patch("/:tripId/days/:dayId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    addUnknownFieldError(body, dayUpdateFields, errors, "Request body");

    const data: {
      dayNumber?: number;
      date?: Date;
    } = {};

    if ("dayNumber" in body) {
      const dayNumber = parseOptionalInteger(body.dayNumber, "dayNumber", errors);
      if (dayNumber !== undefined) {
        if (dayNumber < 1) {
          errors.push("dayNumber must be greater than or equal to 1");
        } else {
          data.dayNumber = dayNumber;
        }
      }
    }

    if ("date" in body) {
      const date = parseOptionalDate(body.date, "date", errors);
      if (date) {
        data.date = date;
      }
    }

    if (Object.keys(data).length === 0 && errors.length === 0) {
      errors.push("At least one updatable field is required");
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const day = await prisma.tripDay.update({
      where: { id: dayId },
      data,
      include: dayDetailsInclude
    });

    return res.json({ day });
  } catch (error) {
    logInternalError("update day", error);
    return res.status(500).json({ message: "Failed to update trip day" });
  }
});

tripsRouter.delete("/:tripId/days/:dayId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    await prisma.tripDay.delete({ where: { id: dayId } });
    return res.status(204).send();
  } catch (error) {
    logInternalError("delete day", error);
    return res.status(500).json({ message: "Failed to delete trip day" });
  }
});

tripsRouter.get("/:tripId/days/:dayId/places", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const places = await prisma.tripPlace.findMany({
      where: { tripDayId: dayId },
      orderBy: { orderIndex: "asc" }
    });

    return res.json({ places });
  } catch (error) {
    logInternalError("list places", error);
    return res.status(500).json({ message: "Failed to list places" });
  }
});

tripsRouter.post("/:tripId/days/:dayId/places", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const body = req.body as unknown;
    const errors: string[] = [];

    const parsedPlace = parsePlaceCreateInput(body, "Request body", errors);
    if (errors.length > 0 || !parsedPlace) {
      return sendValidationError(res, errors);
    }

    const place = await prisma.tripPlace.create({
      data: {
        tripDayId: dayId,
        ...toPlaceCreateData(parsedPlace)
      }
    });

    return res.status(201).json({ place });
  } catch (error) {
    logInternalError("create place", error);
    return res.status(500).json({ message: "Failed to create place" });
  }
});

tripsRouter.get("/:tripId/days/:dayId/places/:placeId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    const placeId = parseRequiredParam(req.params.placeId, "placeId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    if (!placeId) {
      return res.status(400).json({ message: "placeId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const place = await prisma.tripPlace.findFirst({
      where: { id: placeId, tripDayId: dayId }
    });
    if (!place) {
      return res.status(404).json({ message: "Place not found" });
    }

    return res.json({ place });
  } catch (error) {
    logInternalError("get place detail", error);
    return res.status(500).json({ message: "Failed to get place" });
  }
});

tripsRouter.patch("/:tripId/days/:dayId/places/:placeId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    const placeId = parseRequiredParam(req.params.placeId, "placeId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    if (!placeId) {
      return res.status(400).json({ message: "placeId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const placeExists = await findPlaceInDay(dayId, placeId);
    if (!placeExists) {
      return res.status(404).json({ message: "Place not found" });
    }

    const body = req.body as unknown;
    if (!isRecord(body)) {
      return res.status(400).json({ message: "Request body must be a JSON object" });
    }

    const errors: string[] = [];
    addUnknownFieldError(body, placeFields, errors, "Request body");

    const data: {
      orderIndex?: number;
      name?: string;
      address?: string | null;
      lat?: number | null;
      lng?: number | null;
      category?: string;
      imageUrl?: string | null;
      phone?: string | null;
      memo?: string | null;
      startTime?: string | null;
      endTime?: string | null;
    } = {};

    if ("orderIndex" in body) {
      const orderIndex = parseOptionalInteger(body.orderIndex, "orderIndex", errors);
      if (orderIndex !== undefined) {
        if (orderIndex < 0) {
          errors.push("orderIndex must be greater than or equal to 0");
        } else {
          data.orderIndex = orderIndex;
        }
      }
    }

    if ("name" in body) {
      const name = parseRequiredNonEmptyString(body.name, "name", errors);
      if (name) data.name = name;
    }

    if ("address" in body) {
      const address = parseOptionalNullableNonEmptyString(body.address, "address", errors);
      if (address !== undefined) data.address = address;
    }

    if ("lat" in body) {
      const lat = parseOptionalNullableNumber(body.lat, "lat", errors);
      if (lat !== undefined) data.lat = lat;
    }

    if ("lng" in body) {
      const lng = parseOptionalNullableNumber(body.lng, "lng", errors);
      if (lng !== undefined) data.lng = lng;
    }

    if ("category" in body) {
      const category = parseRequiredNonEmptyString(body.category, "category", errors);
      if (category) data.category = category;
    }

    if ("imageUrl" in body) {
      const imageUrl = parseOptionalNullableNonEmptyString(body.imageUrl, "imageUrl", errors);
      if (imageUrl !== undefined) data.imageUrl = imageUrl;
    }

    if ("phone" in body) {
      const phone = parseOptionalNullableNonEmptyString(body.phone, "phone", errors);
      if (phone !== undefined) data.phone = phone;
    }

    if ("memo" in body) {
      const memo = parseOptionalNullableNonEmptyString(body.memo, "memo", errors);
      if (memo !== undefined) data.memo = memo;
    }

    if ("startTime" in body) {
      const startTime = parseOptionalNullableNonEmptyString(body.startTime, "startTime", errors);
      if (startTime !== undefined) data.startTime = startTime;
    }

    if ("endTime" in body) {
      const endTime = parseOptionalNullableNonEmptyString(body.endTime, "endTime", errors);
      if (endTime !== undefined) data.endTime = endTime;
    }

    if (Object.keys(data).length === 0 && errors.length === 0) {
      errors.push("At least one updatable field is required");
    }

    if (errors.length > 0) {
      return sendValidationError(res, errors);
    }

    const place = await prisma.tripPlace.update({
      where: { id: placeId },
      data
    });

    return res.json({ place });
  } catch (error) {
    logInternalError("update place", error);
    return res.status(500).json({ message: "Failed to update place" });
  }
});

tripsRouter.delete("/:tripId/days/:dayId/places/:placeId", async (req, res) => {
  try {
    const tripId = parseRequiredParam(req.params.tripId, "tripId");
    const dayId = parseRequiredParam(req.params.dayId, "dayId");
    const placeId = parseRequiredParam(req.params.placeId, "placeId");
    if (!tripId) {
      return res.status(400).json({ message: "tripId is required" });
    }

    if (!dayId) {
      return res.status(400).json({ message: "dayId is required" });
    }

    if (!placeId) {
      return res.status(400).json({ message: "placeId is required" });
    }

    const ownedTrip = await findOwnedTrip(tripId, req.user!.userId);
    if (!ownedTrip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    const dayExists = await findDayInTrip(tripId, dayId);
    if (!dayExists) {
      return res.status(404).json({ message: "Day not found" });
    }

    const placeExists = await findPlaceInDay(dayId, placeId);
    if (!placeExists) {
      return res.status(404).json({ message: "Place not found" });
    }

    await prisma.tripPlace.delete({ where: { id: placeId } });
    return res.status(204).send();
  } catch (error) {
    logInternalError("delete place", error);
    return res.status(500).json({ message: "Failed to delete place" });
  }
});

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
