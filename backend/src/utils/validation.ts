import { z } from "zod";

const email = z.string().email().toLowerCase().trim();

export const createJobSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(100_000),
  to: z.array(email).min(1).max(10_000),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  idempotencyKey: z.string().uuid().optional(),
});

export function dedupeEmails(list: string[]): string[] {
  return [...new Set(list.map((e) => e.toLowerCase().trim()).filter(Boolean))];
}

export function parseScheduledAt(input: string): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid scheduledAt datetime");
  return d;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
