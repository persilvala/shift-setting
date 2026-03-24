"use client";

import { useEffect, useState } from "react";
import { createAdmin, deleteAdmin } from "@/actions/auth";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";

type Admin = {
  id: number;
  username: string;
  mustChangePassword: boolean;
  createdAt: Date;
};

export function AdminList({
  admins: initialAdmins,
  currentAdminId,
}: {
  admins: Admin[];
  currentAdminId: number | null;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [admins]);

  const totalPages = Math.max(1, Math.ceil(admins.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginatedAdmins = admins.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await createAdmin(username, password);

    if (result.success) {
      setUsername("");
      setPassword("");
      window.location.reload();
    } else {
      setError(result.error || "Failed to create admin");
    }

    setLoading(false);
  };

  const handleDelete = async (adminId: number) => {
    if (!confirm("Are you sure you want to delete this admin?")) {
      return;
    }

    const result = await deleteAdmin(adminId);

    if (result.success) {
      setAdmins(admins.filter((a) => a.id !== adminId));
    } else {
      alert(result.error || "Failed to delete admin");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
      <header className="space-y-2">
        <PageHeader>Settings</PageHeader>
        <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
          Manage Admins
        </h1>
      </header>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Add New Admin</p>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Create a new admin account</h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-[var(--foreground)]">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[var(--foreground)]">
                Initial Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="Min 8 chars, 1 uppercase"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {loading ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </div>

          <p className="text-sm text-[var(--muted)]">
            New admins must change their password on first login.
          </p>
        </form>
      </section>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Current Admins</p>
          <h2 className="text-xl font-semibold text-[var(--foreground)]">Admin accounts</h2>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
          <table className="min-w-full divide-y divide-[var(--border)]/70">
            <thead className="bg-[var(--surface)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Username
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70 bg-white">
              {paginatedAdmins.map((admin) => (
                <tr key={admin.id} className="hover:bg-[var(--surface)]/60">
                  <td className="px-4 py-4 font-semibold text-[var(--foreground)]">
                    {admin.username}
                    {admin.id === currentAdminId && (
                      <span className="ml-2 text-xs text-[var(--accent)]">(You)</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {admin.mustChangePassword ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                        Must change password
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-[var(--muted)]">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {admin.id !== currentAdminId && (
                      <button
                        onClick={() => handleDelete(admin.id)}
                        className="text-sm font-semibold text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

        <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
          <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
          <span className="text-xs">{admins.length} admin(s)</span>
        </div>
      </section>
    </main>
  );
}
