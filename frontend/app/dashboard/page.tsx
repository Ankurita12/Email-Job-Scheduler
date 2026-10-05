"use client";

import { useCallback, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import StatsCards from "@/components/StatsCards";
import JobTable from "@/components/JobTable";
import { api, type Job } from "@/lib/api";

const STATUSES = ["all", "pending", "processing", "sent", "partial", "failed", "cancelled"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Parameters<typeof StatsCards>[0]["stats"]>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, j] = await Promise.all([
        api.stats(),
        api.jobs({ status, q: q.trim() || undefined }),
      ]);
      setStats(s);
      setJobs(j.jobs);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 400 : 0); // debounce search
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // live progress
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error} — is the backend running at NEXT_PUBLIC_API_URL?</p>}
        <StatsCards stats={stats} />
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${status === s ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-100"}`}
            >
              {s}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subject / email (ES powered)…"
            className="ml-auto w-full rounded-lg border px-3 py-1.5 text-sm md:w-72"
          />
        </div>
        <JobTable jobs={jobs} onChanged={load} />
      </main>
    </>
  );
}
