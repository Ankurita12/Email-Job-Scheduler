"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, googleLoginUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function demoLogin() {
    setLoading(true);
    setError(null);
    try {
      await api.demoLogin();
      router.push("/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6">
      <div className="w-full rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold">ReachInbox Email Scheduler</h1>
        <p className="mt-2 text-sm text-slate-600">
          Schedule bulk emails, track delivery, search history. Ethereal-powered
          previews, Slack alerts, crash-safe queue.
        </p>
        <a
          href={googleLoginUrl()}
          className="mt-6 flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Continue with Google
        </a>
        <button
          onClick={demoLogin}
          disabled={loading}
          className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2.5 font-medium hover:bg-slate-100 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Use demo login (no OAuth keys needed)"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-4 text-xs text-slate-500">
          Backend: Express + BullMQ + Postgres + Redis + ES. Make sure{" "}
          <code>NEXT_PUBLIC_API_URL</code> points at the API (default
          http://localhost:3001).
        </p>
      </div>
    </main>
  );
}
