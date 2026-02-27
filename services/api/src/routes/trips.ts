import { Router } from "express";

const tripsRouter = Router();

tripsRouter.get("/", (_req, res) => {
  res.status(501).json({ message: "Trips list scaffold - not implemented" });
});

tripsRouter.post("/", (_req, res) => {
  res.status(501).json({ message: "Trips create scaffold - not implemented" });
});

tripsRouter.get("/:tripId", (_req, res) => {
  res.status(501).json({ message: "Trips detail scaffold - not implemented" });
});

tripsRouter.patch("/:tripId", (_req, res) => {
  res.status(501).json({ message: "Trips update scaffold - not implemented" });
});

tripsRouter.delete("/:tripId", (_req, res) => {
  res.status(501).json({ message: "Trips delete scaffold - not implemented" });
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
