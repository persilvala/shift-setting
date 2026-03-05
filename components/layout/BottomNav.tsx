"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { key: "payments", label: "Payments", href: "/" },
  { key: "summary", label: "Summary", href: "/summary" },
  { key: "calendar", label: "Calendar", href: "/calendar" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-3xl px-4 pb-4 md:px-6"
      aria-label="Bottom navigation"
    >
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/95 shadow-[0_15px_40px_rgba(16,40,94,0.12)] backdrop-blur">
        <ul className="flex items-center justify-around px-2 py-3">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={item.href}
                  className={`mx-auto flex w-full max-w-[120px] flex-col items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                    active ? "text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-[var(--foreground)] ${
                      active ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                    aria-hidden
                  >
                    {item.key === "payments" && (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h16M4 12h16M4 17h10" />
                        <rect x="3" y="5" width="18" height="14" rx="4" ry="4" />
                      </svg>
                    )}
                    {item.key === "summary" && (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 19h16" />
                        <rect x="4" y="3" width="16" height="14" rx="3" />
                        <path d="M9 8h6" />
                        <path d="M9 11h3" />
                      </svg>
                    )}
                    {item.key === "calendar" && (
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="4" y="4" width="16" height="16" rx="4" />
                        <path d="M8 2v4M16 2v4M4 9h16" />
                        <path d="M9.5 13h1v1h-1zM13.5 13h1v1h-1zM9.5 16h1v1h-1z" />
                      </svg>
                    )}
                  </span>
                  <span>{item.label}</span>
                  {active && <span className="mt-1 h-1 w-8 rounded-full bg-[var(--accent)]" aria-hidden />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
