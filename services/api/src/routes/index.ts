import { Router } from "express";

import { addressRouter } from "./address";
import { authRouter } from "./auth";
import { destinationsRouter } from "./destinations";
import { friendMatchesRouter } from "./friend-matches";
import { plannerRouter } from "./planner";
import { medicalRouter } from "./medical";
import { restaurantsRouter } from "./restaurants";
import { reviewsRouter } from "./reviews";
import { routeRouter } from "./route";
import { tourismRouter } from "./tourism";
import { tripsRouter } from "./trips";
import { weatherRouter } from "./weather";

const apiRouter = Router();

apiRouter.use("/address", addressRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/destinations", destinationsRouter);
apiRouter.use("/friend-matches", friendMatchesRouter);
apiRouter.use("/trips", tripsRouter);
apiRouter.use("/planner", plannerRouter);
apiRouter.use("/reviews", reviewsRouter);
apiRouter.use("/route", routeRouter);
apiRouter.use("/tourism", tourismRouter);
apiRouter.use("/weather", weatherRouter);
apiRouter.use("/restaurants", restaurantsRouter);
apiRouter.use("/medical", medicalRouter);

export { apiRouter };
