import { Router } from "express";
import { healthRouter } from "./health.routes";
import { sessionRouter } from "./session.routes";

// Top-level router mounted on the Express app. Keeps the app assembly in
// app.ts free of path/handler details.
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/api/sessions", sessionRouter);