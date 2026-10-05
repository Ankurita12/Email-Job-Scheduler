"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { API_URL } from "@/lib/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ total: number; invalid: number; preview: string[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doPreview() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/upload/preview`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function doSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subject", subject);
      fd.append("body", body);
      fd.append("scheduledAt", new Date().toISOString());
      const res = await fetch(`${API_URL}/api/upload/schedule`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Schedule failed");
      setMsg(`Scheduled job ${data.job.id} → ${data.total} recipient(s) (${data.invalid} invalid rows skipped).`);
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
        <h1 className="text-2xl font-bold">CSV upload</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a CSV with one email per cell. First row may be a header (<code>email</code>).
        </p>
        <div className="mt-4 flex flex-col gap-4 rounded-xl border bg-white p-6">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button onClick={doPreview} disabled={!file || busy}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50">
            Preview CSV
          </button>
          {preview && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p><b>{preview.total}</b> valid emails, {preview.invalid} invalid rows.</p>
              <ul className="mt-2 list-disc pl-5 text-slate-700">
                {preview.preview.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
          <form onSubmit={doSchedule} className="flex flex-col gap-3 border-t pt-4">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required
              placeholder="Subject" className="rounded-lg border px-3 py-2 text-sm" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4}
              placeholder="Body (HTML allowed)" className="rounded-lg border px-3 py-2 text-sm" />
            <button disabled={!file || busy}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? "Working…" : "Schedule now for all rows"}
            </button>
          </form>
          {msg && <p className="text-sm text-slate-700">{msg}</p>}
        </div>
      </main>
    </>
  );
}
