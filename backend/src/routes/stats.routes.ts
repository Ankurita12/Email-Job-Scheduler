import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get("/", async (_req, res) => {
  const [byStatus, totalLogs, sentLogs] = await Promise.all([
    prisma.emailJob.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.emailLog.count(),
    prisma.emailLog.count({ where: { status: "sent" } }),
  ]);
  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row.status] = row._count.status;
  res.json({
    totalJobs: Object.values(counts).reduce((a, b) => a + b, 0),
    byStatus: counts,
    totalEmails: totalLogs,
    sentEmails: sentLogs,
  });
});

export default router;
