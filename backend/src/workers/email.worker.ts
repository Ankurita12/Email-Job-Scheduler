import { Worker, Job } from "bullmq";
import { config } from "../config";
import { prisma } from "../db";
import { redisConnection } from "../redis";
import { getTransporter, getPreviewUrl } from "../services/mailer";
import { notifySlack, jobSummaryText } from "../services/slack";
import { indexEmailLog } from "../es";
import { EMAIL_QUEUE_NAME } from "../queues/email.queue";

type SendPayload = { jobId: string };

async function processJob(job: Job<SendPayload>) {
  const { jobId } = job.data;
  // fetch job + recipients (include above needs where — do it properly)
  const record = await prisma.emailJob.findUnique({
    where: { id: jobId },
    include: { logs: true },
  });
  if (!record) throw new Error(`EmailJob ${jobId} not found`);
  if (record.status === "cancelled") return; // skip cancelled
  if (record.status === "sent") return; // already done (idempotent)

  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: "processing" },
  });

  const transporter = await getTransporter();
  let sent = 0;
  let failed = 0;
  let firstPreview: string | null = null;

  const recipients = record.logs.map((l: { toEmail: string }) => l.toEmail);

  for (const to of recipients) {
    // Skip already-sent recipients (retry-safe, prevents duplicates)
    const existing = await prisma.emailLog.findUnique({
      where: { jobId_toEmail: { jobId, toEmail: to } },
    });
    if (existing?.status === "sent") {
      sent++;
      continue;
    }
    try {
      const info = await transporter.sendMail({
        from: config.etherealFrom,
        to,
        subject: record.subject,
        html: record.bodyHtml,
      });
      const previewUrl = getPreviewUrl(info);
      if (previewUrl && !firstPreview) firstPreview = previewUrl;
      await prisma.emailLog.upsert({
        where: { jobId_toEmail: { jobId, toEmail: to } },
        update: {
          status: "sent",
          attempts: { increment: 1 },
          previewUrl,
          sentAt: new Date(),
          error: null,
        },
        create: {
          jobId,
          toEmail: to,
          status: "sent",
          attempts: 1,
          previewUrl,
          sentAt: new Date(),
        },
      });
      sent++;
      await indexEmailLog({
        jobId,
        toEmail: to,
        subject: record.subject,
        body: record.bodyHtml.slice(0, 2000),
        status: "sent",
        previewUrl,
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      failed++;
      const message = (err as Error).message;
      await prisma.emailLog.upsert({
        where: { jobId_toEmail: { jobId, toEmail: to } },
        update: { status: "failed", attempts: { increment: 1 }, error: message },
        create: { jobId, toEmail: to, status: "failed", attempts: 1, error: message },
      });
      await indexEmailLog({
        jobId,
        toEmail: to,
        subject: record.subject,
        body: record.bodyHtml.slice(0, 2000),
        status: "failed",
        sentAt: new Date().toISOString(),
      });
    }
  }

  const finalStatus = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
  await prisma.emailJob.update({
    where: { id: jobId },
    data: { status: finalStatus as never, sentCount: sent, failedCount: failed },
  });

  await notifySlack(
    jobSummaryText({
      subject: record.subject,
      jobId,
      sent,
      failed,
      total: recipients.length,
      previewUrl: firstPreview,
    })
  );

  if (finalStatus === "failed") throw new Error(`All ${recipients.length} emails failed`);
}

export function startWorker() {
  const worker = new Worker<SendPayload>(EMAIL_QUEUE_NAME, processJob, {
    connection: redisConnection,
    concurrency: config.workerConcurrency,
    limiter: { max: config.emailRateMax, duration: config.emailRateDurationMs },
  });

  worker.on("completed", (job) => console.log(`[worker] completed ${job.id}`));
  worker.on("failed", (job, err) =>
    console.warn(`[worker] failed ${job?.id}: ${err.message}`)
  );
  worker.on("error", (err) =>
    console.error("[worker] error:", (err as Error)?.message || String(err))
  );

  console.log(
    `[worker] listening (concurrency=${config.workerConcurrency}, rate=${config.emailRateMax}/${config.emailRateDurationMs}ms)`
  );
  return worker;
}

/**
 * Persistence after restart: re-enqueue every pending/processing job that
 * isn't already in Redis (e.g. server crashed mid-delay).
 */
export async function recoverPendingJobs(): Promise<number> {
  const { emailQueue } = await import("../queues/email.queue");
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ["pending", "processing"] } },
  });
  let restored = 0;
  for (const j of pending) {
    const existing = await emailQueue.getJob(j.idempotencyKey);
    if (existing) continue;
    const delay = Math.max(0, new Date(j.scheduledAt).getTime() - Date.now());
    await emailQueue.add(
      "send-email",
      { jobId: j.id },
      { jobId: j.idempotencyKey, delay }
    );
    restored++;
  }
  if (restored > 0) console.log(`[recovery] re-queued ${restored} pending job(s)`);
  return restored;
}

// keep TS happy about unused import in processJob header
export type { SendPayload as WorkerPayload };
