"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { TopNav } from "@/components/layout/TopNav"
import { PageHeader } from "@/components/PageHeader"
import { Pagination } from "@/components/Pagination"
import { addAdminLog } from "@/lib/adminLogs"
import type {
  Employee,
  ParsedTimesheetRow,
  SavedPayroll,
} from "@/lib/types"

type PayrollEntryRow = {
  employeeId: string
  employeeName: string
  date: string
  timesheetRowId: string | number | null
  startDate: string
  endDate: string
  attendanceDays: number
  halfDays: number
  absentDays: number
  basePayPerDay: number | null
  basePay: number
  addedValue: number
  subtractedValue: number
  netPay: number
  isEdited: boolean
}

type PayrollData = {
  payroll: PayrollEntryRow[]
  startDate: string
  endDate: string
}

type AttendanceAggregate = {
  employeeId: string
  employeeName: string
  date: string
  attendanceDays: number
  halfDays: number
  absentDays: number
  timesheetRowId: string | number | null
}

type EmployeeInRange = {
  id: string
  name: string
  rows: number
}

function buildAttendanceData(rows: ParsedTimesheetRow[]): AttendanceAggregate[] {
  type WorkingRow = AttendanceAggregate

  const byEmployeeDate = new Map<string, WorkingRow>()

  rows.forEach((row) => {
    const employeeKey = String(row.employeeId || row.employeeName || "")
    const dateKey = row.date || "unknown"
    const key = `${employeeKey}-${dateKey}`
    if (!employeeKey || !dateKey) return

    if (!byEmployeeDate.has(key)) {
      byEmployeeDate.set(key, {
        employeeId: String(row.employeeId || employeeKey),
        employeeName: row.employeeName || "Unnamed",
        date: dateKey,
        attendanceDays: 0,
        halfDays: 0,
        absentDays: 0,
        timesheetRowId: row.id ? String(row.id) : null,
      })
    }

    const entry = byEmployeeDate.get(key)!
    const status = row.attendanceStatus || "full_day"
    switch (status) {
      case "full_day":
        entry.attendanceDays = 1
        break
      case "half_day":
        entry.halfDays = 1
        break
      case "absent":
        entry.absentDays = 1
        break
    }
  })

  return Array.from(byEmployeeDate.values())
}

const formatMoney = (value: number) => `$${value.toFixed(2)}`

export default function PayrollPage() {
  const [rangeRows, setRangeRows] = useState<ParsedTimesheetRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  const [payrollData, setPayrollData] = useState<PayrollData | null>(null)
  const [pendingAggregation, setPendingAggregation] = useState<
    AttendanceAggregate[] | null
  >(null)
  const [savedPayrolls, setSavedPayrolls] = useState<SavedPayroll[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [payrollPage, setPayrollPage] = useState(1)
  const [savedPage, setSavedPage] = useState(1)

  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedUser, setSelectedUser] = useState<string>("")

  const [activeEmployeeId, setActiveEmployeeId] = useState<string | number | null>(null)

  const [missingBasePayModalOpen, setMissingBasePayModalOpen] =
    useState(false)
  const [missingBasePayEntries, setMissingBasePayEntries] = useState<
    AttendanceAggregate[]
  >([])
  const [missingBasePayInputs, setMissingBasePayInputs] = useState<
    Record<string, string>
  >({})
  const [bulkBasePay, setBulkBasePay] = useState("")
  const [updatingBasePay, setUpdatingBasePay] = useState(false)

  const [editModal, setEditModal] = useState<{
    employeeId: string
    employeeName: string
    attendanceDays: number
    halfDays: number
    absentDays: number
    addedValue: number
    subtractedValue: number
    netPay: number
    basePay: number
    basePayPerDay: number | null
    isEdited: boolean
  } | null>(null)

  const [selectedPayrollDetail, setSelectedPayrollDetail] = useState<{
    id: string
    startDate: string
    endDate: string
    basePayPerDay: number
    totalNetPay: number
    isEdited: boolean
    generatedAt: string
    entries: Array<{
      id: string
      employeeId: string
      employeeName: string
      timesheetRowId: string | null
      date: string | null
      attendanceDays: number
      halfDays: number
      absentDays: number
      basePay: number
      addedValue: number
      subtractedValue: number
      netPay: number
      isEdited: boolean
      note: string | null
      noteCreatedBy: string | null
      noteCreatedAt: string | null
      noteEditedBy: string | null
      noteEditedAt: string | null
    }>
  } | null>(null)

  const [employeeEntriesModal, setEmployeeEntriesModal] = useState<{
    employeeId: string
    employeeName: string
    entries: Array<{
      id: string
      date: string | null
      attendanceDays: number
      halfDays: number
      absentDays: number
      basePay: number
      addedValue: number
      subtractedValue: number
      netPay: number
      isEdited: boolean
    }>
  } | null>(null)

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null)

  const [noteModalData, setNoteModalData] = useState<{
    payrollId: string
    entryId: string
    employeeId: string
    employeeName: string
    note: string | null
    noteCreatedBy: string | null
    noteCreatedAt: string | null
    noteEditedBy: string | null
    noteEditedAt: string | null
  } | null>(null)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  const PAGE_SIZE = 10

  const dateError = useMemo(() => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Enter valid dates"
    }
    if (start >= end) {
      return "Start date must be earlier than end date"
    }
    return null
  }, [endDate, startDate])

  const isDateInvalid = Boolean(dateError)

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees")
      const data = await response.json()
      if (data.employees) {
        setEmployees(data.employees)
        return data.employees as Employee[]
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err)
    }
    return [] as Employee[]
  }, [])

  const fetchSavedPayrolls = useCallback(async () => {
    try {
      const response = await fetch("/api/payroll")
      const data = await response.json()
      if (data.payrolls) {
        setSavedPayrolls(data.payrolls)
      }
    } catch (err) {
      console.error("Failed to fetch saved payrolls:", err)
    }
  }, [])

  const fetchPayrollDetail = useCallback(async (payrollId: string) => {
    try {
      const response = await fetch(`/api/payroll/${payrollId}`)
      const data = await response.json()
      if (data.payroll) {
        setSelectedPayrollDetail(data.payroll)
      }
    } catch (err) {
      console.error("Failed to fetch payroll detail:", err)
    }
  }, [])

  const getEmployeeBasePay = useCallback(
    (
      employeeId: string | number,
      employeeName: string,
      list?: Employee[],
    ): number | null => {
      const lookup = list ?? employees
      const numericId =
        typeof employeeId === "string" ? parseInt(employeeId, 10) : employeeId
      const emp = lookup.find(
        (e) => e.id === numericId || e.employeeName === employeeName,
      )
      if (emp?.basePayPerDay !== null && emp?.basePayPerDay !== undefined) {
        return emp.basePayPerDay
      }
      return null
    },
    [employees],
  )

  const aggregatedPayrollEntries = useMemo(() => {
    if (!selectedPayrollDetail) return []
    const grouped = new Map<string, {
      employeeId: string
      employeeName: string
      totalBasePay: number
      totalAdded: number
      totalSubtracted: number
      totalNetPay: number
      hasEdited: boolean
      note: string | null
      noteCreatedBy: string | null
      noteCreatedAt: string | null
      noteEditedBy: string | null
      noteEditedAt: string | null
      entries: Array<{
        id: string
        date: string | null
        attendanceDays: number
        halfDays: number
        absentDays: number
        basePay: number
        addedValue: number
        subtractedValue: number
        netPay: number
        isEdited: boolean
        note: string | null
        noteCreatedBy: string | null
        noteCreatedAt: string | null
        noteEditedBy: string | null
        noteEditedAt: string | null
      }>
    }>()

    selectedPayrollDetail.entries.forEach((entry) => {
      const key = entry.employeeId
      if (!grouped.has(key)) {
        grouped.set(key, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          totalBasePay: 0,
          totalAdded: 0,
          totalSubtracted: 0,
          totalNetPay: 0,
          hasEdited: false,
          note: entry.note,
          noteCreatedBy: entry.noteCreatedBy,
          noteCreatedAt: entry.noteCreatedAt,
          noteEditedBy: entry.noteEditedBy,
          noteEditedAt: entry.noteEditedAt,
          entries: [],
        })
      }
      const group = grouped.get(key)!
      group.totalBasePay += entry.basePay
      group.totalAdded += entry.addedValue
      group.totalSubtracted += entry.subtractedValue
      group.totalNetPay += entry.netPay
      if (entry.isEdited) group.hasEdited = true
      if (entry.note) {
        group.note = entry.note
        group.noteCreatedBy = entry.noteCreatedBy
        group.noteCreatedAt = entry.noteCreatedAt
        group.noteEditedBy = entry.noteEditedBy
        group.noteEditedAt = entry.noteEditedAt
      }
      group.entries.push({
        id: entry.id,
        date: entry.date,
        attendanceDays: entry.attendanceDays,
        halfDays: entry.halfDays,
        absentDays: entry.absentDays,
        basePay: entry.basePay,
        addedValue: entry.addedValue,
        subtractedValue: entry.subtractedValue,
        netPay: entry.netPay,
        isEdited: entry.isEdited,
        note: entry.note,
        noteCreatedBy: entry.noteCreatedBy,
        noteCreatedAt: entry.noteCreatedAt,
        noteEditedBy: entry.noteEditedBy,
        noteEditedAt: entry.noteEditedAt,
      })
    })

    return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [selectedPayrollDetail])

  const totalNetPay = useMemo(() => {
    if (!payrollData) return 0
    return payrollData.payroll.reduce((sum, entry) => sum + entry.netPay, 0)
  }, [payrollData])

  const employeesInRange: EmployeeInRange[] = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; rows: number }>()
    rangeRows.forEach((row) => {
      const key = String(row.employeeId || row.employeeName || "")
      if (!key) return
      const name = row.employeeName || "Unnamed"
      counts.set(key, {
        id: key,
        name,
        rows: (counts.get(key)?.rows || 0) + 1,
      })
    })
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [rangeRows])

  const activeEmployeeRows = useMemo(() => {
    if (!activeEmployeeId) return [] as ParsedTimesheetRow[]
    return rangeRows.filter((row) => {
      const key = String(row.employeeId || row.employeeName || "")
      return key === String(activeEmployeeId)
    })
  }, [activeEmployeeId, rangeRows])

  useEffect(() => {
    if (employeesInRange.length && !activeEmployeeId) {
      setActiveEmployeeId(employeesInRange[0].id)
    }
    if (!employeesInRange.length) {
      setActiveEmployeeId(null)
    }
  }, [activeEmployeeId, employeesInRange])

  useEffect(() => {
    fetchEmployees()
    fetchSavedPayrolls()
  }, [fetchEmployees, fetchSavedPayrolls])

  const fetchScopedRows = useCallback(async () => {
    if (!startDate || !endDate) return
    if (isDateInvalid) return
    setRowsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ startDate, endDate })
      if (selectedUser.trim()) {
        params.append("employeeName", selectedUser.trim())
      }
      const response = await fetch(`/api/timesheets/range?${params.toString()}`)
      const data = await response.json()
      if (!data.ok) {
        setError(data.error ?? "Failed to load timesheets for range")
        setRangeRows([])
        return
      }
      setRangeRows(data.rows ?? [])
      setPayrollData(null)
      setPendingAggregation(null)
    } catch (err) {
      console.error("Failed to load scoped rows:", err)
      setError("Failed to load timesheets for range")
      setRangeRows([])
    } finally {
      setRowsLoading(false)
    }
  }, [endDate, isDateInvalid, selectedUser, startDate])

  useEffect(() => {
    fetchScopedRows()
  }, [fetchScopedRows])

  useEffect(() => {
    setPayrollPage(1)
  }, [payrollData?.payroll?.length])

  useEffect(() => {
    setSavedPage(1)
  }, [savedPayrolls.length])

  // Aggregate payrollData by employee for the generated summary
  const aggregatedGeneratedPayroll = useMemo(() => {
    if (!payrollData) return []
    const grouped = new Map<string, {
      employeeId: string
      employeeName: string
      basePayPerDay: number
      totalAttendanceDays: number
      totalHalfDays: number
      totalAbsentDays: number
      totalBasePay: number
      totalAdded: number
      totalSubtracted: number
      totalNetPay: number
    }>()

    payrollData.payroll.forEach((entry) => {
      const key = entry.employeeId
      if (!grouped.has(key)) {
        grouped.set(key, {
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          basePayPerDay: entry.basePayPerDay ?? 0,
          totalAttendanceDays: 0,
          totalHalfDays: 0,
          totalAbsentDays: 0,
          totalBasePay: 0,
          totalAdded: 0,
          totalSubtracted: 0,
          totalNetPay: 0,
        })
      }
      const group = grouped.get(key)!
      group.totalAttendanceDays += entry.attendanceDays
      group.totalHalfDays += entry.halfDays
      group.totalAbsentDays += entry.absentDays
      group.totalBasePay += entry.basePay
      group.totalAdded += entry.addedValue
      group.totalSubtracted += entry.subtractedValue
      group.totalNetPay += entry.netPay
    })

    return Array.from(grouped.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [payrollData])

  const payrollTotalPages = Math.max(1, Math.ceil(aggregatedGeneratedPayroll.length / PAGE_SIZE))
  const payrollPageSafe = Math.min(payrollPage, payrollTotalPages)
  const paginatedPayroll = aggregatedGeneratedPayroll.slice(
    (payrollPageSafe - 1) * PAGE_SIZE,
    payrollPageSafe * PAGE_SIZE,
  )

  const savedTotalPages = savedPayrolls.length
    ? Math.max(1, Math.ceil(savedPayrolls.length / PAGE_SIZE))
    : 1
  const savedPageSafe = Math.min(savedPage, savedTotalPages)
  const paginatedSaved = savedPayrolls.slice(
    (savedPageSafe - 1) * PAGE_SIZE,
    savedPageSafe * PAGE_SIZE,
  )

  const buildPayrollFromAggregation = useCallback(
    (aggregated: AttendanceAggregate[], overrideEmployees?: Employee[]) => {
      const payroll = aggregated.map((emp) => {
        const basePayPerDay = getEmployeeBasePay(
          emp.employeeId,
          emp.employeeName,
          overrideEmployees,
        )
        const basePay =
          emp.attendanceDays * (basePayPerDay ?? 0) +
          emp.halfDays * (basePayPerDay ?? 0) * 0.5
        const netPay = basePay

        return {
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          date: emp.date,
          timesheetRowId: emp.timesheetRowId,
          startDate: emp.date,
          endDate: emp.date,
          attendanceDays: emp.attendanceDays,
          halfDays: emp.halfDays,
          absentDays: emp.absentDays,
          basePayPerDay,
          basePay: Math.round(basePay * 100) / 100,
          addedValue: 0,
          subtractedValue: 0,
          netPay: Math.round(netPay * 100) / 100,
          isEdited: false,
        }
      })

      setPayrollData({ payroll, startDate, endDate })
      setPendingAggregation(null)
      setError(null)
      addAdminLog({
        action: "Payroll generation",
        status: "Success",
        description: `Generated payroll for ${payroll.length} entry(ies)`,
      })
    },
    [endDate, getEmployeeBasePay, startDate],
  )

  const handleGeneratePayroll = async () => {
    setError(null)
    setSuccess(null)

    if (!startDate || !endDate) {
      setError("Enter start and end dates.")
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "Missing date range.",
      })
      return
    }

    if (isDateInvalid) {
      setError(dateError)
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "Invalid date order.",
      })
      return
    }

    if (!rangeRows.length) {
      setError("No timesheet rows found in this date range.")
      addAdminLog({
        action: "Payroll validation",
        status: "Failed",
        description: "No rows in date range.",
      })
      return
    }

    setLoading(true)

    try {
      const scoped = selectedUser.trim().toLowerCase()
      const scopedRows = scoped
        ? rangeRows.filter((row) => {
            const key = String(row.employeeId || row.employeeName || "").toLowerCase()
            return key.includes(scoped) || (row.employeeName || "").toLowerCase().includes(scoped)
          })
        : rangeRows

      if (!scopedRows.length) {
        setError("No shifts match the selected user/date range.")
        addAdminLog({
          action: "Payroll validation",
          status: "Failed",
          description: "No shifts found for selection.",
        })
        return
      }

      const aggregated = buildAttendanceData(scopedRows)

      // Group by unique employee to check for missing base pay (not per-date)
      const uniqueEmployees = new Map<string, AttendanceAggregate>()
      aggregated.forEach((emp) => {
        const key = emp.employeeId || emp.employeeName
        if (!uniqueEmployees.has(key)) {
          uniqueEmployees.set(key, emp)
        }
      })

      const employeesWithoutBasePay = Array.from(uniqueEmployees.values()).filter((emp) => {
        const basePay = getEmployeeBasePay(emp.employeeId, emp.employeeName)
        return basePay === null
      })

      if (employeesWithoutBasePay.length > 0) {
        setPendingAggregation(aggregated)
        setMissingBasePayEntries(employeesWithoutBasePay)
        setMissingBasePayInputs(
          Object.fromEntries(
            employeesWithoutBasePay.map((e) => [
              String(e.employeeId || e.employeeName),
              "",
            ]),
          ),
        )
        setMissingBasePayModalOpen(true)
        addAdminLog({
          action: "Payroll validation",
          status: "Failed",
          description: `Employees missing base pay: ${employeesWithoutBasePay
            .map((e) => e.employeeName)
            .join(", ")}`,
        })
        return
      }

      buildPayrollFromAggregation(aggregated)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyMissingBasePay = async () => {
    if (!pendingAggregation) return

    const allTargets = missingBasePayEntries.map((entry) => {
      const key = String(entry.employeeId || entry.employeeName)
      const valueRaw = missingBasePayInputs[key]?.trim()
      const value = valueRaw ? Number(valueRaw) : bulkBasePay ? Number(bulkBasePay) : NaN
      return {
        key,
        entry,
        value,
      }
    })

    const invalid = allTargets.find((t) => !Number.isFinite(t.value) || t.value <= 0)
    if (invalid) {
      setError("Enter base pay for all listed employees.")
      return
    }

    setUpdatingBasePay(true)
    setError(null)

    try {
      for (const target of allTargets) {
        const { entry, value } = target
        const numericId =
          typeof entry.employeeId === "string"
            ? parseInt(entry.employeeId, 10)
            : Number(entry.employeeId)
        const matchedEmployee = employees.find(
          (e) => e.id === numericId || e.employeeName === entry.employeeName,
        )

        if (matchedEmployee) {
          await fetch(`/api/employees/${matchedEmployee.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ basePayPerDay: value }),
          })
        } else {
          await fetch("/api/employees", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              employeeName: entry.employeeName,
              basePayPerDay: value,
            }),
          })
        }
      }

      const refreshedEmployees = await fetchEmployees()
      const employeeList = refreshedEmployees.length
        ? refreshedEmployees
        : employees

      setMissingBasePayModalOpen(false)
      setMissingBasePayEntries([])
      setMissingBasePayInputs({})
      setBulkBasePay("")

      if (pendingAggregation) {
        // Group by unique employee to check for still missing
        const uniquePending = new Map<string, AttendanceAggregate>()
        pendingAggregation.forEach((emp) => {
          const key = emp.employeeId || emp.employeeName
          if (!uniquePending.has(key)) {
            uniquePending.set(key, emp)
          }
        })

        const stillMissing = Array.from(uniquePending.values()).filter((emp) => {
          const basePay = getEmployeeBasePay(
            emp.employeeId,
            emp.employeeName,
            employeeList,
          )
          return basePay === null
        })
        if (stillMissing.length) {
          setMissingBasePayEntries(stillMissing)
          setMissingBasePayInputs(
            Object.fromEntries(
              stillMissing.map((e) => [String(e.employeeId || e.employeeName), ""]),
            ),
          )
          setMissingBasePayModalOpen(true)
          return
        }
        buildPayrollFromAggregation(pendingAggregation, employeeList)
      }
    } catch (err) {
      console.error("Failed to update base pay:", err)
      setError("Failed to update base pay for employees.")
    } finally {
      setUpdatingBasePay(false)
    }
  }

  const handleSavePayroll = async () => {
    if (!payrollData) {
      setError("Generate payroll first before saving.")
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description: "Attempted to save without generated payroll.",
      })
      return
    }

    const missingBasePayEmployees = new Set<string>()
    payrollData.payroll.forEach((p) => {
      if (p.basePayPerDay === null || p.basePayPerDay === undefined) {
        missingBasePayEmployees.add(p.employeeName)
      }
    })
    if (missingBasePayEmployees.size > 0) {
      const names = Array.from(missingBasePayEmployees).join(", ")
      setError(`Cannot save: Missing base pay for ${names}`)
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description: `Missing basePayPerDay for: ${names}`,
      })
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const rowLevelEntries = payrollData.payroll.map((emp) => ({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        timesheetRowId: emp.timesheetRowId || "",
        basePayPerDay: emp.basePayPerDay,
        attendanceDays: emp.attendanceDays,
        halfDays: emp.halfDays,
        absentDays: emp.absentDays,
        basePay: emp.basePay,
        addedValue: emp.addedValue,
        subtractedValue: emp.subtractedValue,
        netPay: emp.netPay,
      }))

      const employeeBasePayMap = new Map<string, number>()
      payrollData.payroll.forEach((p) => {
        if (p.basePayPerDay !== null && p.basePayPerDay !== undefined) {
          employeeBasePayMap.set(p.employeeId, p.basePayPerDay)
        }
      })
      const avgBasePay = Array.from(employeeBasePayMap.values()).reduce((sum, val) => sum + val, 0) / employeeBasePayMap.size || 0

      const response = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: payrollData.startDate,
          endDate: payrollData.endDate,
          basePayPerDay: avgBasePay,
          payroll: rowLevelEntries,
          timesheetId: null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.ok) {
        setError(result.error ?? "Failed to save payroll")
        addAdminLog({
          action: "Payroll save",
          status: "Failed",
          description: result.error ?? "Failed to save payroll",
        })
        return
      }

      await fetchEmployees()

      setSuccess("Payroll saved to database successfully!")
      addAdminLog({
        action: "Payroll save",
        status: "Success",
        description: `Saved ${payrollData.payroll.length} payroll entries.`,
      })
      fetchSavedPayrolls()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save payroll")
      addAdminLog({
        action: "Payroll save",
        status: "Failed",
        description: err instanceof Error ? err.message : "Failed to save payroll",
      })
    } finally {
      setSaving(false)
    }
  }

  const saveEditModal = async () => {
    if (!editModal) return

    const newBasePay =
      editModal.attendanceDays * (editModal.basePayPerDay ?? 0) +
      editModal.halfDays * (editModal.basePayPerDay ?? 0) * 0.5
    const newNetPay = newBasePay + editModal.addedValue - editModal.subtractedValue

    if (editingEntryId && editingPayrollId) {
      try {
        const response = await fetch(
          `/api/payroll/${editingPayrollId}/entries/${editingEntryId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attendanceDays: editModal.attendanceDays,
              halfDays: editModal.halfDays,
              absentDays: editModal.absentDays,
              basePay: Math.round(newBasePay * 100) / 100,
              addedValue: editModal.addedValue,
              subtractedValue: editModal.subtractedValue,
              netPay: Math.round(newNetPay * 100) / 100,
            }),
          },
        )

        if (response.ok) {
          const updatedEntry = {
            attendanceDays: editModal.attendanceDays,
            halfDays: editModal.halfDays,
            absentDays: editModal.absentDays,
            addedValue: editModal.addedValue,
            subtractedValue: editModal.subtractedValue,
            basePay: Math.round(newBasePay * 100) / 100,
            netPay: Math.round(newNetPay * 100) / 100,
            isEdited: true,
          }

          setSelectedPayrollDetail((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              isEdited: true,
              entries: prev.entries.map((entry) =>
                entry.id === editingEntryId ? { ...entry, ...updatedEntry } : entry,
              ),
            }
          })

          // Re-open employee entries modal with updated data
          if (selectedPayrollDetail) {
            const employeeEntries = selectedPayrollDetail.entries
              .filter((e) => e.employeeId === editModal.employeeId)
              .map((entry) =>
                entry.id === editingEntryId ? { ...entry, ...updatedEntry } : entry,
              )
            setEmployeeEntriesModal({
              employeeId: editModal.employeeId,
              employeeName: editModal.employeeName,
              entries: employeeEntries,
            })
          }

          addAdminLog({
            action: "Payroll entry edit",
            status: "Success",
            description: `Edited payroll entry for ${editModal.employeeName} (saved payroll)`,
          })
        }
      } catch (err) {
        console.error("Failed to update payroll entry:", err)
      }
    } else if (payrollData) {
      setPayrollData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          payroll: prev.payroll.map((entry) =>
            entry.employeeId === editModal.employeeId
              ? {
                  ...entry,
                  attendanceDays: editModal.attendanceDays,
                  halfDays: editModal.halfDays,
                  absentDays: editModal.absentDays,
                  addedValue: editModal.addedValue,
                  subtractedValue: editModal.subtractedValue,
                  basePay: Math.round(newBasePay * 100) / 100,
                  netPay: Math.round(newNetPay * 100) / 100,
                  isEdited: true,
                }
              : entry,
          ),
        }
      })
      addAdminLog({
        action: "Payroll edit",
        status: "Success",
        description: `Edited payroll for ${editModal.employeeName}`,
      })
    }

    setEditModal(null)
    setEditingEntryId(null)
    setEditingPayrollId(null)
  }

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 md:pt-10 lg:px-10">
        <header className="space-y-2">
          <PageHeader>Payroll</PageHeader>
          <h1 className="text-3xl font-semibold leading-tight text-[var(--foreground)] md:text-4xl">
            Generate payroll by date range
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Pick a date range; we will load timesheet rows in that window and aggregate payroll for employees with data.
          </p>
        </header>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Payroll period and filters
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">
                Filter Employee
              </label>
              <input
                type="search"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                placeholder="All employees"
                list="payroll-user-suggestions"
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
              <datalist id="payroll-user-suggestions">
                {employeesInRange.map((emp) => (
                  <option key={emp.id} value={emp.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[var(--muted)]">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <span className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--muted)]">
                {rowsLoading ? "Loading rows..." : `In scope: ${rangeRows.length} row(s)`}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={handleGeneratePayroll}
              disabled={loading || isDateInvalid}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(47,109,246,0.24)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-80"
            >
              {loading ? "Generating..." : "Generate payroll summary"}
            </button>
            {payrollData && (
              <button
                onClick={handleSavePayroll}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-5 py-3 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save to database"}
              </button>
            )}
            {dateError && (
              <span className="text-sm font-semibold text-red-600">{dateError}</span>
            )}
            {error && (
              <span className="text-sm font-semibold text-red-600">{error}</span>
            )}
            {success && (
              <span className="text-sm font-semibold text-emerald-600">{success}</span>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_18px_50px_rgba(16,40,94,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            <div className="w-full lg:w-1/3">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Employees in range</h3>
              <p className="text-sm text-[var(--muted)]">Only employees with rows in the selected date range are listed.</p>
              <div className="mt-3 space-y-2">
                {employeesInRange.length === 0 && !rowsLoading ? (
                  <p className="text-sm text-[var(--muted)]">No employees found for this range.</p>
                ) : null}
                {employeesInRange.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setActiveEmployeeId(emp.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${activeEmployeeId === emp.id ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]" : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--accent)]"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{emp.name}</span>
                      <span className="text-xs font-semibold text-[var(--muted)]">{emp.rows} row(s)</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-2/3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Timesheet rows</p>
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {activeEmployeeId ? employeesInRange.find((e) => e.id === activeEmployeeId)?.name ?? "Employee" : "Select an employee"}
                  </h3>
                </div>
                <span className="text-xs text-[var(--muted)]">{activeEmployeeRows.length} row(s)</span>
              </div>
              <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
                <div className="overflow-x-auto">
                  <table className="min-w-[800px] w-full text-sm">
                    <thead className="bg-[var(--surface)] text-[var(--muted)]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Dept</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time In</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Time Out</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                      {activeEmployeeRows.map((row) => (
                        <tr key={row.id ?? `${row.employeeName}-${row.date}-${row.sourceLine}`} className="hover:bg-[var(--surface)]/60">
                          <td className="px-4 py-3">{row.date ?? ""}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.attendanceStatus ?? ""}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.dept ?? ""}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.timeIn ?? ""}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.timeOut ?? ""}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{row.totalHours ?? ""}</td>
                        </tr>
                      ))}
                      {activeEmployeeRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--muted)]">
                            {rowsLoading ? "Loading..." : "No rows for this employee in the selected range."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {payrollData && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                  Payroll summary
                </p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {payrollData.startDate} → {payrollData.endDate}
                </h3>
              </div>
              <div className="flex flex-col items-end gap-3 sm:items-end">
                <div className="text-right">
                  <p className="text-sm text-[var(--muted)]">Total net pay</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {formatMoney(totalNetPay)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Total Days
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Added (+)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Subtracted (-)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Net Pay
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {paginatedPayroll.map((entry) => (
                      <tr key={entry.employeeId} className="hover:bg-[var(--surface)]/60">
                        <td className="px-4 py-3 font-semibold">{entry.employeeName}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {entry.totalAttendanceDays + entry.totalHalfDays + entry.totalAbsentDays}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                          {formatMoney(entry.basePayPerDay)}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalAdded)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalSubtracted)}</td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">
                          {formatMoney(entry.totalNetPay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <Pagination
                  page={payrollPageSafe}
                  totalPages={payrollTotalPages}
                  onChange={setPayrollPage}
                />
                <span className="text-xs">{aggregatedGeneratedPayroll.length} employee(s)</span>
              </div>
            </div>
          </section>
        )}

        {savedPayrolls.length > 0 && (
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                  Saved payrolls
                </p>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  From database
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Previously generated and saved payroll records.
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Generated
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Entries
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Avg Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Total Net
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Edited
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {paginatedSaved.map((payroll) => (
                      <tr
                        key={payroll.id}
                        className="hover:bg-[var(--surface)]/60 cursor-pointer"
                        onClick={() => fetchPayrollDetail(String(payroll.id))}
                      >
                        <td className="px-4 py-3 font-semibold text-[var(--accent)]">
                          {new Date(payroll.startDate).toLocaleDateString()} – {new Date(payroll.endDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">
                          {new Date(payroll.generatedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted)]">{payroll._count.entries}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(payroll.basePayPerDay)}</td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">{formatMoney(payroll.totalNetPay)}</td>
                        <td className="px-4 py-3">
                          {payroll.isEdited && (
                            <span className="text-lg text-amber-500" title="Contains edited entries">
                              !
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <Pagination
                  page={savedPageSafe}
                  totalPages={savedTotalPages}
                  onChange={setSavedPage}
                />
                <span className="text-xs">{savedPayrolls.length} saved payroll(s)</span>
              </div>
            </div>
          </section>
        )}

        {selectedPayrollDetail && (
          <section className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--panel)]/90 p-6 shadow-[0_24px_70px_rgba(16,40,94,0.1)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-[var(--muted)]">
                    Payroll Detail
                  </p>
                  <button
                    onClick={() => setSelectedPayrollDetail(null)}
                    className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)] transition hover:border-red-300 hover:text-red-500"
                  >
                    Close
                  </button>
                </div>
                <h3 className="text-xl font-semibold text-[var(--foreground)]">
                  {selectedPayrollDetail.startDate} → {selectedPayrollDetail.endDate}
                </h3>
                <p className="text-sm text-[var(--muted)]">
                  Generated: {new Date(selectedPayrollDetail.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 sm:items-end">
                <div className="text-right">
                  <p className="text-sm text-[var(--muted)]">Total net pay</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {formatMoney(selectedPayrollDetail.totalNetPay)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white/90 shadow-[0_12px_32px_rgba(16,40,94,0.06)]">
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-[var(--surface)] text-[var(--muted)]">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Base Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Added (+)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Subtracted (-)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Net Pay
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Note
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                    {aggregatedPayrollEntries.map((entry) => (
                      <tr
                        key={entry.employeeId}
                        className="hover:bg-[var(--surface)]/60 cursor-pointer"
                        onClick={() => setEmployeeEntriesModal({
                          employeeId: entry.employeeId,
                          employeeName: entry.employeeName,
                          entries: entry.entries,
                        })}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {entry.hasEdited && (
                              <span className="text-lg text-amber-500" title="Contains edited entries">
                                !
                              </span>
                            )}
                            <span className="font-semibold text-[var(--accent)]">{entry.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{formatMoney(entry.totalBasePay)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalAdded)}</td>
                        <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.totalSubtracted)}</td>
                        <td className="px-4 py-3 font-bold text-[var(--accent)]">{formatMoney(entry.totalNetPay)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setNoteModalData({
                                payrollId: selectedPayrollDetail?.id ?? "",
                                entryId: entry.entries[0]?.id ?? "",
                                employeeId: entry.employeeId,
                                employeeName: entry.employeeName,
                                note: entry.note,
                                noteCreatedBy: entry.noteCreatedBy,
                                noteCreatedAt: entry.noteCreatedAt,
                                noteEditedBy: entry.noteEditedBy,
                                noteEditedAt: entry.noteEditedAt,
                              })
                            }}
                            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                              entry.note
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "border border-[var(--border)] text-[var(--muted)] hover:border-blue-300 hover:text-blue-600"
                            }`}
                          >
                            {entry.note ? "📝" : "Add Note"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.hasEdited ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                          >
                            {entry.hasEdited ? "Edited" : "Generated"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-white/90 px-4 py-3 text-sm text-[var(--muted)]">
                <span className="text-xs">
                  {aggregatedPayrollEntries.length} employee(s)
                </span>
              </div>
            </div>
          </section>
        )}

        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Edit payroll entry
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {editModal.employeeName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Added (+)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editModal.addedValue || ""}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          addedValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--muted)]">
                      Subtracted (-)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editModal.subtractedValue || ""}
                      onChange={(e) =>
                        setEditModal({
                          ...editModal,
                          subtractedValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/50 p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--muted)]">Base Pay</p>
                      <p className="font-semibold text-[var(--foreground)]">
                        {formatMoney(
                          editModal.attendanceDays * (editModal.basePayPerDay ?? 0) +
                            editModal.halfDays * (editModal.basePayPerDay ?? 0) * 0.5,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Net Pay</p>
                      <p className="text-xl font-bold text-[var(--accent)]">
                        {formatMoney(
                          editModal.attendanceDays * (editModal.basePayPerDay ?? 0) +
                            editModal.halfDays * (editModal.basePayPerDay ?? 0) * 0.5 +
                            editModal.addedValue -
                            editModal.subtractedValue,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditModal}
                  className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(47,109,246,0.28)] transition hover:scale-[1.01]"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        )}

        {missingBasePayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Base pay required
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    Add base pay to continue
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMissingBasePayModalOpen(false)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/60 p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Set base pay for listed employees
                  </p>
                  <div className="mt-3 grid gap-3">
                    {missingBasePayEntries.map((entry) => {
                      const key = String(entry.employeeId || entry.employeeName)
                      return (
                        <div
                          key={key}
                          className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{entry.employeeName}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {entry.attendanceDays} full · {entry.halfDays} half · {entry.absentDays} absent
                            </p>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={missingBasePayInputs[key] ?? ""}
                            onChange={(e) =>
                              setMissingBasePayInputs((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder="Base pay per day"
                            className="w-full max-w-[200px] rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]/50 p-4">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Bulk set</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkBasePay}
                      onChange={(e) => setBulkBasePay(e.target.value)}
                      placeholder="Set all missing to"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const value = bulkBasePay
                        setMissingBasePayInputs((prev) => {
                          const next = { ...prev }
                          missingBasePayEntries.forEach((entry) => {
                            const key = String(entry.employeeId || entry.employeeName)
                            next[key] = value
                          })
                          return next
                        })
                      }}
                      className="rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:scale-[1.01]"
                    >
                      Apply to all
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setMissingBasePayModalOpen(false)}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyMissingBasePay}
                    disabled={updatingBasePay}
                    className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(47,109,246,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {updatingBasePay ? "Saving..." : "Save base pay and continue"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {employeeEntriesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Employee Payroll Entries
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {employeeEntriesModal.employeeName}
                  </h3>
                  <p className="text-sm text-[var(--muted)]">
                    {employeeEntriesModal.entries.length} day(s) in this payroll period
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmployeeEntriesModal(null)}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="min-w-[900px] w-full text-sm">
                    <thead className="bg-[var(--surface)] text-[var(--muted)] sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Base Pay
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Added (+)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Subtracted (-)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Net Pay
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em]">
                          Edited
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.24em]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/70 text-[var(--foreground)]">
                      {employeeEntriesModal.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[var(--surface)]/60">
                          <td className="px-4 py-3 font-semibold">{entry.date ?? "-"}</td>
                          <td className="px-4 py-3">{formatMoney(entry.basePay)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.addedValue)}</td>
                          <td className="px-4 py-3 text-[var(--muted)]">{formatMoney(entry.subtractedValue)}</td>
                          <td className="px-4 py-3 font-bold text-[var(--accent)]">{formatMoney(entry.netPay)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${entry.isEdited ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                            >
                              {entry.isEdited ? "Edited" : "Generated"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                // Calculate basePayPerDay from entry's basePay and days
                                const days = entry.attendanceDays + (entry.halfDays * 0.5)
                                const calculatedBasePayPerDay = days > 0 ? entry.basePay / days : (selectedPayrollDetail?.basePayPerDay ?? null)
                                
                                setEditModal({
                                  employeeId: employeeEntriesModal.employeeId,
                                  employeeName: employeeEntriesModal.employeeName,
                                  attendanceDays: entry.attendanceDays,
                                  halfDays: entry.halfDays,
                                  absentDays: entry.absentDays,
                                  addedValue: entry.addedValue,
                                  subtractedValue: entry.subtractedValue,
                                  netPay: entry.netPay,
                                  basePay: entry.basePay,
                                  basePayPerDay: calculatedBasePayPerDay,
                                  isEdited: entry.isEdited,
                                })
                                setEditingEntryId(entry.id)
                                setEditingPayrollId(selectedPayrollDetail?.id || null)
                                setEmployeeEntriesModal(null)
                              }}
                              className="rounded-lg border border-[var(--accent)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {noteModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
            <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_28px_80px_rgba(16,40,94,0.24)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
                    Employee Note
                  </p>
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {noteModalData.employeeName}
                  </h3>
                </div>
                {!isEditingNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNote(true)
                      setNoteText(noteModalData.note ?? "")
                    }}
                    className="rounded-lg border border-[var(--accent)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setNoteModalData(null)
                    setIsEditingNote(false)
                    setNoteText("")
                  }}
                  className="rounded-full border border-[var(--border)] px-3 py-1 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {noteModalData.noteCreatedBy && (
                  <div className="text-sm text-[var(--muted)]">
                    {noteModalData.noteEditedBy ? (
                      <>
                        Created by: <span className="font-semibold text-[var(--foreground)]">{noteModalData.noteCreatedBy}</span>
                        {noteModalData.noteCreatedAt && (
                          <> on {new Date(noteModalData.noteCreatedAt).toLocaleDateString()}</>
                        )}
                        <span className="mx-2">|</span>
                        Edited by: <span className="font-semibold text-[var(--foreground)]">{noteModalData.noteEditedBy}</span>
                        {noteModalData.noteEditedAt && (
                          <> on {new Date(noteModalData.noteEditedAt).toLocaleDateString()}</>
                        )}
                      </>
                    ) : (
                      <>
                        Created by: <span className="font-semibold text-[var(--foreground)]">{noteModalData.noteCreatedBy}</span>
                        {noteModalData.noteCreatedAt && (
                          <> on {new Date(noteModalData.noteCreatedAt).toLocaleDateString()}</>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isEditingNote ? (
                  <>
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Enter note..."
                      rows={4}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm resize-none"
                    />
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingNote(false)
                          setNoteText("")
                        }}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setSavingNote(true)
                          try {
                            const response = await fetch(
                              `/api/payroll/${noteModalData.payrollId}/entries/${noteModalData.entryId}/note`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ note: noteText }),
                              },
                            )
                            const result = await response.json()

                            if (result.ok) {
                              setSelectedPayrollDetail((prev) => {
                                if (!prev) return prev
                                return {
                                  ...prev,
                                  entries: prev.entries.map((entry) =>
                                    entry.id === noteModalData.entryId
                                      ? {
                                          ...entry,
                                          note: result.entry.note,
                                          noteCreatedBy: result.entry.noteCreatedBy,
                                          noteCreatedAt: result.entry.noteCreatedAt,
                                          noteEditedBy: result.entry.noteEditedBy,
                                          noteEditedAt: result.entry.noteEditedAt,
                                        }
                                      : entry,
                                  ),
                                }
                              })
                              setNoteModalData((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      note: result.entry.note,
                                      noteCreatedBy: result.entry.noteCreatedBy,
                                      noteCreatedAt: result.entry.noteCreatedAt,
                                      noteEditedBy: result.entry.noteEditedBy,
                                      noteEditedAt: result.entry.noteEditedAt,
                                    }
                                  : null,
                              )
                              addAdminLog({
                                action: "Payroll note",
                                status: "Success",
                                description: noteModalData.note
                                  ? `Edited note for ${noteModalData.employeeName}`
                                  : `Added note for ${noteModalData.employeeName}`,
                              })
                              setIsEditingNote(false)
                            }
                          } catch (err) {
                            console.error("Failed to save note:", err)
                          } finally {
                            setSavingNote(false)
                          }
                        }}
                        disabled={savingNote}
                        className="rounded-xl bg-gradient-to-r from-[var(--accent-strong)] to-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_34px_rgba(47,109,246,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingNote ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/50 p-4 min-h-[100px]">
                    <p className={`text-sm ${noteModalData.note ? "text-[var(--foreground)]" : "text-[var(--muted)] italic"}`}>
                      {noteModalData.note || "No note added yet."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
