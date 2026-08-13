import { Router } from "express";
import { listSessions, getSession, patchSession, deleteSession } from "../controllers/session.controller";

// Route definitions only map HTTP paths → controller handlers. Controllers keep
// the request/response handling; nothing else lives here.
export const sessionRouter = Router();

sessionRouter.get("/", listSessions);
sessionRouter.get("/:sessionId", getSession);
sessionRouter.patch("/:sessionId", patchSession);
sessionRouter.delete("/:sessionId", deleteSession);