import { Router } from "express";
import {
  blockCustomerController,
  getMyProfileController,
  getUserByIdController,
  listUsersController,
  unblockCustomerController,
  updateMyProfileController,
} from "../controllers/user.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.get("/me", requireAuth, getMyProfileController);
userRouter.patch("/me", requireAuth, updateMyProfileController);
userRouter.get("/", requireAuth, requireRole("admin"), listUsersController);
userRouter.get("/:id", requireAuth, requireRole("admin"), getUserByIdController);
userRouter.patch("/:id/block", requireAuth, requireRole("admin"), blockCustomerController);
userRouter.patch("/:id/unblock", requireAuth, requireRole("admin"), unblockCustomerController);

export { userRouter };
