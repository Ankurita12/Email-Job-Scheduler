"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { api } from "@/lib/api";

function defaultTime(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ComposePage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultTime());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const recipients = to.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
      const { job, deduplicated } = await api.createJob({
        subject,
        body,
        to: recipients,
        scheduledAt: new Date(scheduledAt).toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
      setMsg(`${deduplicated ? "Duplicate blocked — existing job returned. " : "Scheduled! "}Job ${job.id} → ${job.totalCount} recipient(s).`);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-2xl p-4">
        <h1 className="text-2xl font-bold">Compose scheduled email</h1>
        <form onSubmit={submit} className="mt-4 flex flex-col gap-4 rounded-xl border bg-white p-6">
          <label className="flex flex-col gap-1 text-sm">
            Recipients (comma / newline separated)
            <textarea value={to} onChange={(e) => setTo(e.target.value)} rows={3} required
              placeholder="alice@example.com, bob@example.com"
              className="rounded-lg border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={300}
              className="rounded-lg border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Body (HTML allowed)
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} required
              placeholder="<h1>Hello</h1><p>Your report is ready.</p>"
              className="rounded-lg border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Send at
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required
              className="rounded-lg border px-3 py-2" />
          </label>
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Scheduling…" : "Schedule email"}
          </button>
          {msg && <p className="text-sm text-slate-700">{msg}</p>}
        </form>
      </main>
    </>
  );
}
