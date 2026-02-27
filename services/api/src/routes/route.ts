import { Router } from "express";

import { optimizeRouteHandler } from "../controllers/route-controller";
import { optimizeRouteRateLimit } from "../middleware/route-rate-limit";

const routeRouter = Router();

routeRouter.post("/optimize", optimizeRouteRateLimit, optimizeRouteHandler);

export { routeRouter };
