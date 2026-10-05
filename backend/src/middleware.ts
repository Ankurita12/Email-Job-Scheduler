import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { prisma } from "./db";

export interface AuthRequest extends Request {
  userId?: string;
}

/** Optional auth: attaches userId when a valid JWT cookie/header exists, else continues anonymous. */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.token ??
      req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return next();
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    // ensure user still exists
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.userId = user.id;
  } catch {
    // ignore — anonymous
  }
  next();
}

/** Strict auth: 401 when no valid JWT. Used on write routes. */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  await optionalAuth(req, res, () => {
    if (!req.userId) {
      // Dev-friendly: allow anonymous writes when no users exist yet
      // (so the scheduler is usable before Google OAuth is configured).
      // In production with users present, this still enforces login.
      prisma.user
        .count()
        .then((count: number) => {
          if (count === 0) return next();
          res.status(401).json({ error: "Not authenticated. Login with Google first." });
        })
        .catch(() => res.status(401).json({ error: "Not authenticated." }));
      return;
    }
    next();
  });
}

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
