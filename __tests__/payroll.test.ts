import { describe, test, expect } from "@jest/globals";

type AttendanceData = {
  employeeId: string;
  employeeName: string;
  date: string;
  attendanceStatus: "absent" | "full_day" | "half_day";
};

type PayrollEntryResult = {
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  attendanceDays: number;
  halfDays: number;
  absentDays: number;
  basePayPerDay: number;
  basePay: number;
  addedValue: number;
  subtractedValue: number;
  netPay: number;
};

function generatePayroll(
  startDate: string,
  endDate: string,
  basePayPerDay: number,
  attendanceData: AttendanceData[]
): PayrollEntryResult[] {
  const byEmployee = new Map<string, {
    employeeId: string;
    employeeName: string;
    attendanceDays: number;
    halfDays: number;
    absentDays: number;
  }>();

  attendanceData.forEach((entry) => {
    const key = entry.employeeId;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        attendanceDays: 0,
        halfDays: 0,
        absentDays: 0,
      });
    }
    const emp = byEmployee.get(key)!;
    switch (entry.attendanceStatus) {
      case "full_day":
        emp.attendanceDays++;
        break;
      case "half_day":
        emp.halfDays++;
        break;
      case "absent":
        emp.absentDays++;
        break;
    }
  });

  const payroll: PayrollEntryResult[] = Array.from(byEmployee.values()).map((emp) => {
    const basePay = (emp.attendanceDays * basePayPerDay) + (emp.halfDays * basePayPerDay * 0.5);
    const netPay = basePay;

    return {
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      startDate,
      endDate,
      attendanceDays: emp.attendanceDays,
      halfDays: emp.halfDays,
      absentDays: emp.absentDays,
      basePayPerDay: Math.round(basePayPerDay * 100) / 100,
      basePay: Math.round(basePay * 100) / 100,
      addedValue: 0,
      subtractedValue: 0,
      netPay: Math.round(netPay * 100) / 100,
    };
  });

  return payroll;
}

describe("Payroll Generation", () => {
  test("should calculate payroll for single employee with full days", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "John Doe", date: "2025-01-01", attendanceStatus: "full_day" },
      { employeeId: "E001", employeeName: "John Doe", date: "2025-01-02", attendanceStatus: "full_day" },
      { employeeId: "E001", employeeName: "John Doe", date: "2025-01-03", attendanceStatus: "full_day" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1000, attendanceData);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      employeeId: "E001",
      employeeName: "John Doe",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      attendanceDays: 3,
      halfDays: 0,
      absentDays: 0,
      basePayPerDay: 1000,
      basePay: 3000,
      addedValue: 0,
      subtractedValue: 0,
      netPay: 3000,
    });
  });

  test("should calculate payroll with mixed attendance statuses", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "Jane Smith", date: "2025-01-01", attendanceStatus: "full_day" },
      { employeeId: "E001", employeeName: "Jane Smith", date: "2025-01-02", attendanceStatus: "half_day" },
      { employeeId: "E001", employeeName: "Jane Smith", date: "2025-01-03", attendanceStatus: "absent" },
      { employeeId: "E001", employeeName: "Jane Smith", date: "2025-01-04", attendanceStatus: "full_day" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1000, attendanceData);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      employeeId: "E001",
      employeeName: "Jane Smith",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      attendanceDays: 2,
      halfDays: 1,
      absentDays: 1,
      basePayPerDay: 1000,
      basePay: 2500, // (2 * 1000) + (1 * 1000 * 0.5)
      addedValue: 0,
      subtractedValue: 0,
      netPay: 2500,
    });
  });

  test("should calculate payroll for multiple employees", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "Alice", date: "2025-01-01", attendanceStatus: "full_day" },
      { employeeId: "E001", employeeName: "Alice", date: "2025-01-02", attendanceStatus: "full_day" },
      { employeeId: "E002", employeeName: "Bob", date: "2025-01-01", attendanceStatus: "full_day" },
      { employeeId: "E002", employeeName: "Bob", date: "2025-01-02", attendanceStatus: "half_day" },
      { employeeId: "E002", employeeName: "Bob", date: "2025-01-03", attendanceStatus: "half_day" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1000, attendanceData);

    expect(result).toHaveLength(2);
    
    const alice = result.find((e) => e.employeeId === "E001");
    const bob = result.find((e) => e.employeeId === "E002");

    expect(alice).toEqual({
      employeeId: "E001",
      employeeName: "Alice",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      attendanceDays: 2,
      halfDays: 0,
      absentDays: 0,
      basePayPerDay: 1000,
      basePay: 2000,
      addedValue: 0,
      subtractedValue: 0,
      netPay: 2000,
    });

    expect(bob).toEqual({
      employeeId: "E002",
      employeeName: "Bob",
      startDate: "2025-01-01",
      endDate: "2025-01-31",
      attendanceDays: 1,
      halfDays: 2,
      absentDays: 0,
      basePayPerDay: 1000,
      basePay: 2000, // (1 * 1000) + (2 * 1000 * 0.5)
      addedValue: 0,
      subtractedValue: 0,
      netPay: 2000,
    });
  });

  test("should handle decimal base pay correctly", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "Test User", date: "2025-01-01", attendanceStatus: "full_day" },
      { employeeId: "E001", employeeName: "Test User", date: "2025-01-02", attendanceStatus: "half_day" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1234.56, attendanceData);

    expect(result).toHaveLength(1);
    expect(result[0].basePay).toBe(1851.84); // (1 * 1234.56) + (1 * 1234.56 * 0.5)
    expect(result[0].netPay).toBe(1851.84);
  });

  test("should handle all absent days", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "Absent User", date: "2025-01-01", attendanceStatus: "absent" },
      { employeeId: "E001", employeeName: "Absent User", date: "2025-01-02", attendanceStatus: "absent" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1000, attendanceData);

    expect(result).toHaveLength(1);
    expect(result[0].attendanceDays).toBe(0);
    expect(result[0].halfDays).toBe(0);
    expect(result[0].absentDays).toBe(2);
    expect(result[0].basePay).toBe(0);
    expect(result[0].netPay).toBe(0);
  });

  test("should round values to 2 decimal places", () => {
    const attendanceData: AttendanceData[] = [
      { employeeId: "E001", employeeName: "Test", date: "2025-01-01", attendanceStatus: "half_day" },
    ];

    const result = generatePayroll("2025-01-01", "2025-01-31", 1000 / 3, attendanceData);

    expect(result).toHaveLength(1);
    expect(result[0].basePayPerDay).toBe(333.33);
    expect(result[0].basePay).toBe(166.67); // 333.33 * 0.5
  });
});
