import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { appointmentRouter } from "./appointment.routes.js";
import { healthRouter } from "./health.routes.js";
import { serviceRouter } from "./service.routes.js";
import { userRouter } from "./user.routes.js";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/appointments", appointmentRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/services", serviceRouter);

export { apiRouter };
