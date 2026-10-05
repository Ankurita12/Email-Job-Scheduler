import { Queue } from "bullmq";
import { redisConnection } from "../redis";

export const EMAIL_QUEUE_NAME = "emailQueue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/** Enqueue one job; BullMQ jobId = idempotencyKey so re-submits dedupe. */
export async function enqueueEmailJob(jobId: string, idempotencyKey: string, delayMs: number) {
  return emailQueue.add(
    "send-email",
    { jobId },
    {
      jobId: idempotencyKey, // dedupe at queue level
      delay: Math.max(0, delayMs),
    }
  );
}
