"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/logs", label: "Logs" },
];

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-8 sm:px-8">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)] p-5 text-sm text-[var(--muted)] shadow-lg backdrop-blur lg:flex">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
          <span className="text-[var(--foreground)]">Shift Setting</span>
          <span className="rounded-full bg-white/10 px-2 py-1">Admin</span>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition ${active ? "border-[var(--accent)]/70 bg-[var(--surface)] text-[var(--foreground)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${active ? "bg-[var(--accent)]" : "bg-white/20"}`}
                  />
                  {item.label}
                </span>
                <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">
                  {active ? "Active" : "Go"}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-xs text-[var(--muted)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Status</p>
          <p className="pt-2 text-base font-semibold text-[var(--foreground)]">System healthy</p>
          <p>Next sync at 14:05 UTC</p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col gap-6 rounded-3xl border border-[var(--border)]/70 bg-[var(--panel)] p-6 shadow-xl backdrop-blur">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-[var(--muted)]">Admin workspace</p>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">Operations control</h1>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--foreground)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live sync
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--foreground)]">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              Coverage stable
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
