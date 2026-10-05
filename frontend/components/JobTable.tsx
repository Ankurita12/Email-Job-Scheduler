"use client";

import { api, type Job } from "@/lib/api";

export function statusColor(s: Job["status"]): string {
  switch (s) {
    case "sent":
      return "bg-green-100 text-green-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "cancelled":
      return "bg-slate-200 text-slate-700";
    case "partial":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function JobTable({
  jobs,
  onChanged,
}: {
  jobs: Job[];
  onChanged: () => void;
}) {
  async function cancel(id: string) {
    if (!confirm("Cancel this scheduled job?")) return;
    try {
      await api.cancelJob(id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  if (jobs.length === 0)
    return <p className="py-8 text-center text-slate-500">No jobs yet.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-3">Subject</th>
            <th className="p-3">Status</th>
            <th className="p-3">Scheduled</th>
            <th className="p-3">Progress</th>
            <th className="p-3">Preview</th>
            <th className="p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const preview = j.logs.find((l) => l.previewUrl)?.previewUrl;
            return (
              <tr key={j.id} className="border-t">
                <td className="p-3 font-medium">
                  {j.subject}
                  <div className="text-xs font-normal text-slate-500">
                    {j.logs.slice(0, 3).map((l) => l.toEmail).join(", ")}
                    {j.logs.length > 3 && ` +${j.logs.length - 3} more`}
                  </div>
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(j.status)}`}
                  >
                    {j.status}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {new Date(j.scheduledAt).toLocaleString()}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {j.sentCount}/{j.totalCount} sent
                  {j.failedCount > 0 && ` (${j.failedCount} failed)`}
                </td>
                <td className="p-3">
                  {preview ? (
                    <a
                      href={preview}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      Ethereal
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="p-3">
                  {(j.status === "pending" || j.status === "processing") && (
                    <button
                      onClick={() => cancel(j.id)}
                      className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
