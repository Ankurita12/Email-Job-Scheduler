import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import passport from "passport";
import { config } from "./config";
import { prisma } from "./db";
import { initPassport } from "./auth";
import { apiLimiter } from "./middleware";
import { initElasticsearch } from "./es";
import { startWorker, recoverPendingJobs } from "./workers/email.worker";
import authRoutes from "./routes/auth.routes";
import jobsRoutes from "./routes/jobs.routes";
import uploadRoutes from "./routes/upload.routes";
import statsRoutes from "./routes/stats.routes";

async function main() {
  const app = express();

  app.use(helmet());
  app.use(morgan("dev"));
  app.use(
    cors({
      origin: [config.frontendUrl, "http://localhost:3000"],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(passport.initialize());
  initPassport();

  app.use("/api/", apiLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use("/auth", authRoutes);
  app.use("/api/jobs", jobsRoutes);
  app.use("/api/upload", uploadRoutes);
  app.use("/api/stats", statsRoutes);

  // Non-fatal infra: ES optional, Redis required for queue
  await initElasticsearch().catch(() => undefined);

  try {
    startWorker();
    await recoverPendingJobs();
  } catch (err) {
    console.warn("[boot] worker/recovery unavailable (is Redis running?):", (err as Error).message);
  }

  app.listen(config.port, () =>
    console.log(`[api] listening on http://localhost:${config.port}`)
  );

  // Graceful shutdown: flush Prisma
  const shutdown = async () => {
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
