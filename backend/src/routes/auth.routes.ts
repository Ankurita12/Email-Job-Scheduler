import { Router } from "express";
import passport from "passport";
import { config, isGoogleConfigured } from "../config";
import { signToken } from "../auth";
import { prisma } from "../db";
import { AuthRequest, optionalAuth } from "../middleware";

const router = Router();

router.get("/google", (_req, res, next) => {
  if (!isGoogleConfigured)
    return res.status(501).json({
      error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.",
    });
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(_req, res, next);
});

router.get("/google/callback", (_req, res, next) => {
  if (!isGoogleConfigured) return res.status(501).json({ error: "Google OAuth not configured." });
  passport.authenticate(
    "google",
    { session: false },
    (err: unknown, user: { id: string } | false) => {
      if (err || !user) return res.redirect(`${config.frontendUrl}/?auth=failed`);
      const token = signToken((user as { id: string }).id);
      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 3600 * 1000,
      });
      res.redirect(`${config.frontendUrl}/dashboard?auth=ok`);
    }
  )(_req, res, next);
});

// Dev fallback: create/use a demo user without Google (useful before OAuth keys exist)
router.post("/demo-login", async (_req, res) => {
  const user = await prisma.user.upsert({
    where: { email: "demo@reachinbox.local" },
    update: {},
    create: { email: "demo@reachinbox.local", name: "Demo User" },
  });
  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 * 1000 });
  res.json({ token, user });
});

router.get("/me", optionalAuth, async (req: AuthRequest, res) => {
  if (!req.userId) return res.status(401).json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json({ user });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
