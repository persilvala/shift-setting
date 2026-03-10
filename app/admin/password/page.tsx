"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "@/actions/auth";

export default function PasswordChangePage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await changePassword(currentPassword, newPassword, confirmPassword);

    if (result.success) {
      router.push("/admin/dashboard");
    } else {
      setError(result.error || "Failed to change password");
    }

    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Change Password</h1>
          <p className="mt-2 text-[var(--muted)]">
            You must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-8 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-semibold text-[var(--foreground)]">
              Current Password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Enter current password"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-semibold text-[var(--foreground)]">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Min 8 characters, 1 uppercase"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[var(--foreground)]">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              placeholder="Re-enter new password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-80"
          >
            {loading ? "Changing password..." : "Change Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
