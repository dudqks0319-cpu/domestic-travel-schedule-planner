import { Router } from "express";

import { optimizeRouteHandler } from "../controllers/route-controller";

const routeRouter = Router();

routeRouter.post("/optimize", optimizeRouteHandler);

export { routeRouter };
