import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { authRoutes } from "./auth";
import { healthRoutes } from "./health";
import { monetizationRoutes } from "./monetization";
import { opsRoutes } from "./ops";
import { placeRoutes } from "./places";
import { plannerRoutes } from "./planner";
import { routeRoutes } from "./routes";
import { shareRoutes, tripRoutes } from "./trips";

export const v1Routes = new Hono<AppBindings>();

v1Routes.route("/health", healthRoutes);

v1Routes.route("/auth", authRoutes);

v1Routes.route("/places", placeRoutes);

v1Routes.route("/planner", plannerRoutes);
v1Routes.route("/routes", routeRoutes);

v1Routes.route("/trips", tripRoutes);

v1Routes.route("/share", shareRoutes);

v1Routes.route("/monetization", monetizationRoutes);

v1Routes.route("/ops", opsRoutes);
