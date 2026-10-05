import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { v4 as uuid } from "uuid";
import { prisma } from "../db";
import { AuthRequest, requireAuth } from "../middleware";
import { EMAIL_RE, dedupeEmails } from "../utils/validation";
import { enqueueEmailJob } from "../queues/email.queue";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

function extractEmailsFromCsv(buffer: Buffer): { emails: string[]; invalid: number } {
  const text = buffer.toString("utf-8");
  let records: string[][];
  try {
    records = parse(text, { skip_empty_lines: true, trim: true }) as string[][];
  } catch {
    throw new Error("Could not parse CSV. Ensure it is comma-separated text.");
  }
  const emails: string[] = [];
  let invalid = 0;
  for (const row of records) {
    for (const cell of row) {
      const val = String(cell).trim().toLowerCase();
      if (!val || val === "email" || val === "emails") continue; // skip header
      if (EMAIL_RE.test(val)) emails.push(val);
      else invalid++;
    }
  }
  return { emails: dedupeEmails(emails).slice(0, 10_000), invalid };
}

/** POST /api/upload/preview — parse CSV, return first rows without creating a job. */
router.post("/preview", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field: file)" });
  try {
    const { emails, invalid } = extractEmailsFromCsv(req.file.buffer);
    res.json({ total: emails.length, invalid, preview: emails.slice(0, 20) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

/** POST /api/upload/schedule — parse CSV + create scheduled job for all rows. */
router.post("/schedule", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded (field: file)" });
  const { subject, body, scheduledAt, idempotencyKey } = req.body as Record<string, string>;
  if (!subject || !body || !scheduledAt)
    return res.status(400).json({ error: "subject, body and scheduledAt are required" });
  const scheduled = new Date(scheduledAt);
  if (Number.isNaN(scheduled.getTime())) return res.status(400).json({ error: "Invalid scheduledAt" });

  try {
    const { emails, invalid } = extractEmailsFromCsv(req.file.buffer);
    if (emails.length === 0) return res.status(400).json({ error: "No valid emails found in CSV", invalid });

    const key = idempotencyKey && idempotencyKey.length > 5 ? idempotencyKey : uuid();
    const existing = await prisma.emailJob.findUnique({ where: { idempotencyKey: key } });
    if (existing) return res.status(200).json({ job: existing, deduplicated: true, invalid });

    const job = await prisma.emailJob.create({
      data: {
        idempotencyKey: key,
        subject: String(subject),
        bodyHtml: String(body),
        scheduledAt: scheduled,
        totalCount: emails.length,
        createdById: req.userId ?? null,
        logs: { create: emails.map((toEmail) => ({ toEmail })) },
      },
    });
    await enqueueEmailJob(job.id, key, Math.max(0, scheduled.getTime() - Date.now()));
    res.status(201).json({ job, total: emails.length, invalid, deduplicated: false });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

export default router;
