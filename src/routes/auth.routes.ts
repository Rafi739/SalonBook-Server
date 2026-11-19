import { Router } from "express";
import { getCurrentUser } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const authRouter = Router();

authRouter.get("/me", requireAuth, getCurrentUser);

export { authRouter };
