import { Request, Response, NextFunction } from "express";

// Terminal request/response middleware (the outer edge of the request pipeline):
// a JSON 404 for unmatched paths and a catch-all error handler so route/controller
// failures always produce a structured JSON response instead of an HTML error.

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not Found" });
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal Server Error" });
}