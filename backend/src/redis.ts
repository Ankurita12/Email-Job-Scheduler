import IORedis from "ioredis";
import { config } from "./config";

export const redisConnection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
});
