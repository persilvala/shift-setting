"use client";

import React from "react";

type PaginationProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
};

function buildItems(page: number, totalPages: number) {
  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  const add = (p: number | "ellipsis") => pages.push(p);

  add(1);
  if (page > 4) add("ellipsis");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) add(i);

  if (page < totalPages - 3) add("ellipsis");
  add(totalPages);

  return pages;
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  const items = buildItems(page, totalPages);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const baseBtn =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50";

  const ghostBtn = `${baseBtn} border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]/70 hover:text-[var(--foreground)]`;
  const solidBtn = `${baseBtn} border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_10px_24px_rgba(47,109,246,0.18)] hover:brightness-[1.05]`;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => canPrev && onChange(page - 1)}
        disabled={!canPrev}
        className={ghostBtn}
        aria-label="Previous page"
      >
        Prev
      </button>

      {items.map((item, idx) => {
        if (item === "ellipsis") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="px-2 text-sm font-semibold text-[var(--muted)]"
            >
              …
            </span>
          );
        }

        const isActive = item === page;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={isActive ? solidBtn : ghostBtn}
            aria-current={isActive ? "page" : undefined}
          >
            {item}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => canNext && onChange(page + 1)}
        disabled={!canNext}
        className={ghostBtn}
        aria-label="Next page"
      >
        Next
      </button>
    </div>
  );
}
