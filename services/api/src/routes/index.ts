import { Router } from "express";

import { authRouter } from "./auth";
import { plannerRouter } from "./planner";
import { medicalRouter } from "./medical";
import { restaurantsRouter } from "./restaurants";
import { routeRouter } from "./route";
import { tourismRouter } from "./tourism";
import { tripsRouter } from "./trips";
import { weatherRouter } from "./weather";

const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/trips", tripsRouter);
apiRouter.use("/planner", plannerRouter);
apiRouter.use("/route", routeRouter);
apiRouter.use("/tourism", tourismRouter);
apiRouter.use("/weather", weatherRouter);
apiRouter.use("/restaurants", restaurantsRouter);
apiRouter.use("/medical", medicalRouter);

export { apiRouter };
