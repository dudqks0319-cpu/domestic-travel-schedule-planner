import { Router } from "express";
import { optimizeRouteHandler } from "../controllers/route-controller";

const plannerRouter = Router();

plannerRouter.post("/route/optimize", optimizeRouteHandler);

plannerRouter.post("/generate", (_req, res) => {
  res.status(501).json({
    message: "Planner itinerary generation scaffold - not implemented"
  });
});

plannerRouter.post("/trips/:tripId/replan", (_req, res) => {
  res.status(501).json({
    message: "Planner trip replan scaffold - not implemented"
  });
});

plannerRouter.get("/trips/:tripId/summary", (_req, res) => {
  res.status(501).json({
    message: "Planner trip summary scaffold - not implemented"
  });
});

plannerRouter.get("/suggestions/destinations", (_req, res) => {
  res.status(501).json({
    message: "Planner destination suggestions scaffold - not implemented"
  });
});

export { plannerRouter };
