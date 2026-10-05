import { Router } from "express";
import { v4 as uuid } from "uuid";
import { prisma } from "../db";
import { AuthRequest, requireAuth } from "../middleware";
import { createJobSchema, dedupeEmails, parseScheduledAt } from "../utils/validation";
import { enqueueEmailJob } from "../queues/email.queue";
import { searchEmailLogs } from "../es";

const router = Router();

/**
 * POST /api/jobs — schedule an email to N recipients.
 * Idempotent via `idempotencyKey` (auto-generated when omitted).
 */
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });

  const { subject, body } = parsed.data;
  const recipients = dedupeEmails(parsed.data.to);
  if (recipients.length === 0) return res.status(400).json({ error: "No valid recipients" });

  let scheduledAt: Date;
  try {
    scheduledAt = parseScheduledAt(parsed.data.scheduledAt);
  } catch {
    return res.status(400).json({ error: "Invalid scheduledAt" });
  }

  const idempotencyKey = parsed.data.idempotencyKey ?? uuid();

  // Duplicate guard: same key → return existing job (no second email)
  const existing = await prisma.emailJob.findUnique({
    where: { idempotencyKey },
    include: { logs: { take: 5 } },
  });
  if (existing)
    return res.status(200).json({ job: existing, deduplicated: true });

  const job = await prisma.emailJob.create({
    data: {
      idempotencyKey,
      subject,
      bodyHtml: body,
      scheduledAt,
      totalCount: recipients.length,
      createdById: req.userId ?? null,
      logs: { create: recipients.map((toEmail) => ({ toEmail })) },
    },
    include: { logs: true },
  });

  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await enqueueEmailJob(job.id, idempotencyKey, delay);

  res.status(201).json({ job, deduplicated: false });
});

/** GET /api/jobs — list with status filter + search (ES first, Postgres fallback). */
router.get("/", async (req, res) => {
  const status = String(req.query.status ?? "all");
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20) || 20));

  const where: Record<string, unknown> = {};
  if (["pending", "processing", "sent", "failed", "cancelled", "partial"].includes(status))
    where.status = status;

  if (q) {
    const esIds = await searchEmailLogs(q).catch(() => null);
    if (esIds && esIds.length > 0) {
      where.id = { in: esIds };
    } else if (!esIds) {
      // ES down or no index → Postgres fallback
      where.OR = [
        { subject: { contains: q, mode: "insensitive" } },
        { logs: { some: { toEmail: { contains: q, mode: "insensitive" } } } },
      ];
    } else {
      // ES up but no matches → empty result
      return res.json({ jobs: [], total: 0, page, pageSize });
    }
  }

  const [total, jobs] = await Promise.all([
    prisma.emailJob.count({ where: where as never }),
    prisma.emailJob.findMany({
      where: where as never,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { logs: { take: 10, orderBy: { createdAt: "asc" } } },
    }),
  ]);

  res.json({ jobs, total, page, pageSize });
});

router.get("/:id", async (req, res) => {
  const job = await prisma.emailJob.findUnique({
    where: { id: req.params.id },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

router.delete("/:id/cancel", requireAuth, async (req, res) => {
  const job = await prisma.emailJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (["sent", "failed", "cancelled"].includes(job.status))
    return res.status(409).json({ error: `Cannot cancel a ${job.status} job` });

  const { emailQueue } = await import("../queues/email.queue");
  try {
    await emailQueue.remove(job.idempotencyKey);
  } catch {
    // already picked up by worker — DB flag still stops processing loop
  }
  const updated = await prisma.emailJob.update({
    where: { id: job.id },
    data: { status: "cancelled" },
  });
  res.json({ job: updated });
});

export default router;
