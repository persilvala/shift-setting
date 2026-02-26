"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { key: "payments", label: "Payments", href: "/" },
  { key: "summary", label: "Summary", href: "/summary" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
  { key: "logs", label: "Logs", href: "/logs" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    document.cookie = "demo-auth=; Max-Age=0; path=/";
    router.push("/login");
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-[var(--border)] bg-[var(--panel)]/90 shadow-[0_10px_40px_rgba(16,40,94,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-[var(--muted)]">
          <span className="h-2 w-2 rounded-full bg-[var(--accent)] shadow-[0_0_0_6px_rgba(47,109,246,0.18)]" />
          Shift Setting
        </div>
        <div className="flex items-center gap-3">
          <ul className="flex items-center gap-2 sm:gap-3">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
