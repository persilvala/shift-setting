"use client"

import { useEffect, useState } from "react"
import { TopNav } from "@/components/layout/TopNav"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"

interface AuditLog {
  id: string
  action: string
  adminName: string
  description: string
  status: string
  createdAt: string
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [filterUser, setFilterUser] = useState("")
  const [filterDate, setFilterDate] = useState("")
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const PAGE_SIZE = 10

  const fetchLogs = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
        ...(filterUser && { admin: filterUser }),
        ...(filterDate && { date: filterDate }),
      })

      const res = await fetch(`/api/audit?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()

      setLogs(data.logs)
      setTotalCount(data.pagination.total)
    } catch (error) {
      console.error("Failed to fetch logs:", error)
      setLogs([])
      setTotalCount(0)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [page, filterUser, filterDate])

  useEffect(() => {
    setPage(1)
  }, [filterUser, filterDate])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const statusBadge = (status: string) => {
    const palette: Record<string, string> = {
      Success: "bg-emerald-100 text-emerald-700 border-emerald-200",
      Failed: "bg-red-100 text-red-700 border-red-200",
      Cancelled: "bg-amber-100 text-amber-700 border-amber-200",
      Info: "bg-blue-100 text-blue-700 border-blue-200",
    }
    return palette[status] ?? "bg-gray-100 text-gray-700 border-gray-200"
  }

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <PageHeader>Admin logs</PageHeader>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">Audit important actions</h1>
          <p className="text-sm text-[var(--muted)]">Uploads, payroll confirmations, failed validations, and cancellations are captured here.</p>
        </header>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Admin user</label>
                <input
                  type="search"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  placeholder="Filter by admin"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Date</label>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLogs}
                  className="mt-6 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01]"
                >
                  Refresh
                </button>
              </div>
            </div>
            <span className="rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--muted)]">{totalCount} record(s)</span>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
            <div className="overflow-x-auto">
              <table className="min-w-[960px] w-full text-sm">
                <thead className="bg-[var(--surface)] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Admin</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted)]">Loading...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-[var(--muted)]">No admin logs yet.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{log.action}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{log.adminName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{new Date(log.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge(log.status)}`}>{log.status}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{log.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--muted)]">
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
            />
            <span className="text-xs">{totalCount} record(s)</span>
          </div>
        </section>
      </main>
    </div>
  )
}
