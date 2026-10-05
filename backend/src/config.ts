import dotenv from "dotenv";
dotenv.config();

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const config = {
  port: num("PORT", 3001),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3001/auth/google/callback",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  etherealUser: process.env.ETHEREAL_USER ?? "",
  etherealPass: process.env.ETHEREAL_PASS ?? "",
  etherealFrom:
    process.env.ETHEREAL_FROM ?? "ReachInbox Scheduler <scheduler@reachinbox.local>",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL ?? "",
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  workerConcurrency: num("WORKER_CONCURRENCY", 5),
  emailRateMax: num("EMAIL_RATE_MAX", 10),
  emailRateDurationMs: num("EMAIL_RATE_DURATION_MS", 60_000),
};

export const isGoogleConfigured =
  config.googleClientId.length > 0 && config.googleClientSecret.length > 0;
