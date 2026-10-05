export default function StatsCards({
  stats,
}: {
  stats: {
    totalJobs: number;
    byStatus: Record<string, number>;
    totalEmails: number;
    sentEmails: number;
  } | null;
}) {
  const cards = [
    { label: "Total jobs", value: stats?.totalJobs ?? 0 },
    { label: "Scheduled (pending)", value: stats?.byStatus.pending ?? 0 },
    { label: "Sent jobs", value: stats?.byStatus.sent ?? 0 },
    { label: "Failed / partial", value: (stats?.byStatus.failed ?? 0) + (stats?.byStatus.partial ?? 0) },
    { label: "Emails sent", value: stats?.sentEmails ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-white p-4">
          <div className="text-2xl font-bold">{c.value}</div>
          <div className="text-xs text-slate-500">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
