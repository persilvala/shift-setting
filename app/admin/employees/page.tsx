"use client";

import { useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";

type Employee = {
  id: string;
  employeeName: string;
  basePayPerDay: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employeeName: "",
    basePayPerDay: "",
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmployees(data.employees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paginatedEmployees = employees.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  const handleOpenAdd = () => {
    setFormData({ employeeName: "", basePayPerDay: "" });
    setEditingEmployee(null);
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      employeeName: emp.employeeName,
      basePayPerDay: emp.basePayPerDay?.toString() ?? "",
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        employeeName: formData.employeeName,
        basePayPerDay: formData.basePayPerDay ? parseFloat(formData.basePayPerDay) : null,
      };

      const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : "/api/employees";
      const method = editingEmployee ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchEmployees();
      handleCloseModal();
      setSuccessMessage(editingEmployee ? "Employee updated successfully!" : "Employee added successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save employee");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this employee?")) return;

    try {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      await fetchEmployees();
      setSuccessMessage("Employee deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete employee");
    }
  };

  const formatMoney = (value: number | null) => {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <PageHeader>Employees</PageHeader>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Manage your team
          </h1>
        </header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">Total employees</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{employees.length}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchEmployees}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(47,109,246,0.22)] transition hover:scale-[1.02]"
              >
                + Add Employee
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 rounded-full bg-[var(--surface)] p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-[var(--foreground)]">No employees yet</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Add your first employee to get started.</p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-4 rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white"
              >
                + Add Employee
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Employee Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Base Pay/Day</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {paginatedEmployees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-4 font-semibold">{emp.employeeName}</td>
                        <td className="px-4 py-4 text-[var(--muted)]">{formatMoney(emp.basePayPerDay)}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(emp)}
                            className="mr-4 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(emp.id)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
                <span className="text-xs">Showing {paginatedEmployees.length} of {employees.length} employee(s)</span>
              </div>
            </>
          )}
        </section>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
            <div className="border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                {editingEmployee ? "Edit Employee" : "Add New Employee"}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {editingEmployee ? "Update employee details." : "Fill in the employee details below."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Employee Name *
                  </label>
                  <input
                    type="text"
                    value={formData.employeeName}
                    onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })}
                    required
                    placeholder="John Doe"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm transition focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Base Pay Per Day
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.basePayPerDay}
                      onChange={(e) => setFormData({ ...formData, basePayPerDay: e.target.value })}
                      placeholder="0.00 (optional)"
                      className="w-full rounded-xl border border-[var(--border)] bg-white py-3 pl-8 pr-4 text-sm transition focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">Leave empty if not set yet.</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-5">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-xl border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(47,109,246,0.25)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingEmployee ? "Update Employee" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
