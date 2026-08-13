import express from "express";
import cors from "cors";
import { requireAuth, rateLimit, resolveAllowedOrigins } from "./utils/security";
import { apiRouter } from "./routes";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware";

// Express application assembly (middleware + routes). Controllers, routes and
// middleware each live in their own folder; request/response handling is fully
// separated from the HTTP bootstrap that lives in server.ts.
export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(cors({ origin: resolveAllowedOrigins() }));
  app.use(express.json());

  // Security: optional bearer auth + per-IP rate limiting on the API.
  app.use("/api", requireAuth);
  app.use("/api", rateLimit);

  // Routes → controllers (session CRUD + health check).
  app.use(apiRouter);

  // 404 + terminal error handling.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}