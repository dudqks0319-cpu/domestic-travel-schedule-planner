import { Hono } from "hono";

import type { AppBindings } from "../bindings";
import { requireAuth } from "../middleware/auth";
import { healthRoutes } from "./health";
import { notImplemented } from "../http/errors";
import { placeRoutes } from "./places";
import { plannerRoutes } from "./planner";
import { routeRoutes } from "./routes";
import { shareRoutes, tripRoutes } from "./trips";

export const v1Routes = new Hono<AppBindings>();

v1Routes.route("/health", healthRoutes);

v1Routes.route("/places", placeRoutes);

v1Routes.route("/planner", plannerRoutes);
v1Routes.route("/routes", routeRoutes);

v1Routes.route("/trips", tripRoutes);
v1Routes.post("/trips/:tripId/days", requireAuth, (c) => notImplemented(c, "여행 일차 추가"));
v1Routes.patch("/trips/:tripId/days/:dayId", requireAuth, (c) => notImplemented(c, "여행 일차 수정"));
v1Routes.post("/trips/:tripId/places", requireAuth, (c) => notImplemented(c, "여행 장소 추가"));
v1Routes.patch("/trips/:tripId/places/:placeId", requireAuth, (c) => notImplemented(c, "여행 장소 수정"));
v1Routes.delete("/trips/:tripId/places/:placeId", requireAuth, (c) => notImplemented(c, "여행 장소 삭제"));

v1Routes.route("/share", shareRoutes);

v1Routes.post("/monetization/ad-events", (c) => notImplemented(c, "광고 이벤트"));
v1Routes.post("/monetization/affiliate-clicks", (c) => notImplemented(c, "제휴 클릭"));
v1Routes.post("/monetization/entitlements/verify", requireAuth, (c) => notImplemented(c, "프리미엄 권한 검증"));
v1Routes.get("/monetization/entitlements/me", requireAuth, (c) => notImplemented(c, "내 프리미엄 권한"));
