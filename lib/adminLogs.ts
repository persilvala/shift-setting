export type AdminLogStatus = "Success" | "Failed" | "Cancelled" | "Info";

export type AdminLogEntry = {
  id: string;
  action: string;
  admin: string;
  timestamp: string;
  description: string;
  status: AdminLogStatus;
  context?: Record<string, unknown>;
};

const STORAGE_KEY = "shift-setting-admin-logs";

function parseStoredLogs(raw: string | null): AdminLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AdminLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAdminLogs(): AdminLogEntry[] {
  if (typeof window === "undefined") return [];
  return parseStoredLogs(localStorage.getItem(STORAGE_KEY));
}

export function addAdminLog(entry: Omit<AdminLogEntry, "id" | "timestamp" | "admin"> & { admin?: string; timestamp?: string }) {
  if (typeof window === "undefined") return null;

  const timestamp = entry.timestamp ?? new Date().toISOString();
  const admin = entry.admin ?? "Admin";
  const log: AdminLogEntry = {
    id: crypto.randomUUID(),
    action: entry.action,
    admin,
    timestamp,
    description: entry.description,
    status: entry.status,
    context: entry.context,
  };

  const existing = getAdminLogs();
  const next = [log, ...existing].slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  fetch("/api/audit/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: entry.action,
      description: entry.description,
      status: entry.status,
      adminName: admin,
      metadata: entry.context,
    }),
  }).catch(console.error);

  return log;
}

export function clearAdminLogs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
