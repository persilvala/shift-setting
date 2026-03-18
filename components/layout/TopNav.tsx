"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/admin/dashboard" },
  { key: "timesheets", label: "Timesheets", href: "/admin/timesheets" },
  { key: "employees", label: "Employees", href: "/admin/employees" },
  { key: "payroll", label: "Payroll", href: "/admin/payroll" },
  { key: "logs", label: "Admin Logs", href: "/admin/logs" },
  { key: "admins", label: "Settings", href: "/admin/admins" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    await signOut({ redirectTo: "/login" });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--border)] bg-[var(--panel)]/90 shadow-[0_10px_40px_rgba(16,40,94,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(47,109,246,0.18)]" />
          Shift Setting
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <span className="flex flex-col items-center justify-center gap-1">
              <span className="block h-0.5 w-5 bg-current"></span>
              <span className="block h-0.5 w-5 bg-current"></span>
              <span className="block h-0.5 w-5 bg-current"></span>
            </span>
          </button>
          <div className="hidden items-center gap-3 md:flex">
            <ul className="flex items-center gap-2 sm:gap-3">
              {navItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                        active
                          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/70 hover:text-[var(--foreground)]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                      {active && <span className="hidden text-[10px] uppercase tracking-[0.28em] text-[var(--muted)] sm:inline">Active</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--panel)]/95 px-4 py-3 shadow-[0_12px_40px_rgba(16,40,94,0.08)] md:hidden">
          <ul className="flex flex-col gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/70 hover:text-[var(--foreground)]"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.label}
                    {active && <span className="text-[10px] uppercase tracking-[0.28em] text-[var(--muted)]">Active</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/15 px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--accent)] hover:border-[var(--accent)] hover:text-white"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
