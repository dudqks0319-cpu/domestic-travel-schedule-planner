import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { healthRouter } from "./routes/health";
import { apiRouter } from "./routes";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(healthRouter);
app.use(env.apiPrefix, apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
