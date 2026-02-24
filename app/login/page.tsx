"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const highlights = [
  "Live coverage heatmaps",
  "Exception-ready approvals",
  "Audit-grade event logs",
];

const metrics = [
  { title: "Shift readiness", value: "98%", detail: "coverage confirmed" },
  { title: "Approvals today", value: "14", detail: "pending decisions" },
  { title: "Open incidents", value: "2", detail: "under review" },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    document.cookie = "demo-auth=1; path=/; max-age=86400";
    const next = searchParams.get("next") || "/";
    setTimeout(() => {
      setMessage("Signed in. Redirecting…");
      router.push(next);
    }, 250);
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 md:px-10">
      <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_1fr]">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--border)]/70 bg-gradient-to-br from-[#f7faff]/95 via-[#eef3ff]/95 to-[#e5edff]/95 p-10 shadow-[0_24px_80px_rgba(16,40,94,0.12)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(47,109,246,0.18),transparent_35%),radial-gradient(circle_at_82%_18%,rgba(33,86,200,0.18),transparent_30%),radial-gradient(circle_at_50%_85%,rgba(47,109,246,0.18),transparent_38%)]" />
          <div className="relative space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-3 py-1 text-sm text-[var(--muted)] shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(47,109,246,0.18)]" />
              Shift Setting Control Room
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Admin access</p>
              <h1 className="text-4xl font-semibold leading-tight text-[var(--foreground)] md:text-5xl">
                Coordinate shifts with confident oversight.
              </h1>
              <p className="max-w-2xl text-lg text-[var(--muted)]">
                Log in to review coverage, unblock approvals, and keep a clean audit trail—all in a workspace built for operations teams.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/80 px-4 py-2 text-sm text-[var(--foreground)] shadow-sm backdrop-blur"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  {item}
                </div>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.title}
                  className="rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-5 backdrop-blur"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{metric.title}</p>
                  <p className="pt-2 text-3xl font-semibold text-[var(--foreground)]">{metric.value}</p>
                  <p className="text-sm text-[var(--muted)]">{metric.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative rounded-3xl border border-[var(--border)]/80 bg-[var(--panel)] p-8 shadow-[0_24px_70px_rgba(16,40,94,0.12)] backdrop-blur">
          <div className="mb-8 space-y-2">
            <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Welcome back</p>
            <h2 className="text-3xl font-semibold text-[var(--foreground)]">Sign in to continue</h2>
            <p className="text-sm text-[var(--muted)]">Use your operations credentials to access dashboards and audit tools.</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@shiftsetting.com"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-inner outline-none ring-1 ring-transparent transition focus:border-[var(--accent)] focus:ring-[var(--accent)]/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-inner outline-none ring-1 ring-transparent transition focus:border-[var(--accent)] focus:ring-[var(--accent)]/30"
              />
            </div>

            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  defaultChecked
                />
                Keep me signed in
              </label>
              <Link href="#" className="text-[var(--accent)] hover:text-[var(--accent-strong)]">
                Forgot access?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-4 py-3 text-center text-base font-semibold text-white shadow-lg shadow-[rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
            >
              <span className="relative">{loading ? "Signing in…" : "Sign in"}</span>
            </button>
            <p className="text-xs text-[var(--muted)]">This demo login sets a local cookie to unlock the dashboard view.</p>
            <div aria-live="polite" className="text-sm font-medium text-[var(--accent)]">
              {message}
            </div>
          </form>

          <div className="mt-8 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm text-[var(--muted)]">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
              <div>
                <p className="font-semibold text-[var(--foreground)]">Need access?</p>
                <p>Contact an admin to be added to the on-call rotation or request a temporary approval window.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <div>
                <p className="font-semibold text-[var(--foreground)]">Status</p>
                <p>System healthy — next sync in 4 minutes.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
