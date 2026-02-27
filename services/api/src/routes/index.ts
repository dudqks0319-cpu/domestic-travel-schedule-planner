import { Router } from "express";

import { authRouter } from "./auth";
import { plannerRouter } from "./planner";
import { routeRouter } from "./route";
import { tripsRouter } from "./trips";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/trips", tripsRouter);
apiRouter.use("/planner", plannerRouter);
apiRouter.use("/route", routeRouter);

export { apiRouter };
