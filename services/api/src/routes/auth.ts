import { Router } from "express";

const authRouter = Router();

authRouter.post("/register", (_req, res) => {
  res.status(501).json({ message: "Auth register scaffold - not implemented" });
});

authRouter.post("/login", (_req, res) => {
  res.status(501).json({ message: "Auth login scaffold - not implemented" });
});

authRouter.post("/refresh", (_req, res) => {
  res.status(501).json({ message: "Auth refresh scaffold - not implemented" });
});

authRouter.post("/logout", (_req, res) => {
  res.status(501).json({ message: "Auth logout scaffold - not implemented" });
});

authRouter.get("/me", (_req, res) => {
  res.status(501).json({ message: "Auth me scaffold - not implemented" });
});

export { authRouter };
