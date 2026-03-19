// Standalone payroll test script (no Jest required)

type AttendanceStatus = "absent" | "full_day" | "half_day";

type AttendanceData = {
  employeeId: string;
  employeeName: string;
  date: string;
  attendanceStatus: AttendanceStatus;
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
  attendanceData: AttendanceData[],
): PayrollEntryResult[] {
  const byEmployee = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      attendanceDays: number;
      halfDays: number;
      absentDays: number;
    }
  >();

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

  const payroll: PayrollEntryResult[] = Array.from(byEmployee.values()).map(
    (emp) => {
      const basePay =
        emp.attendanceDays * basePayPerDay + emp.halfDays * basePayPerDay * 0.5;
      const netPay = basePay;

      return {
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        startDate,
        endDate,
        attendanceDays: emp.attendanceDays,
        halfDays: emp.halfDays,
        absentDays: emp.absentDays,
        basePayPerDay,
        basePay: Math.round(basePay * 100) / 100,
        addedValue: 0,
        subtractedValue: 0,
        netPay: Math.round(netPay * 100) / 100,
      };
    },
  );

  return payroll;
}

// Test utilities
let passed = 0;
let failed = 0;

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.log(`✗ ${message}`);
    console.log(`  Expected: ${expectedStr}`);
    console.log(`  Actual:   ${actualStr}`);
    failed++;
  }
}

// Tests
console.log("=== Payroll Generation Tests ===\n");

// Test 1: Single employee with full days
console.log("Test 1: Single employee with full days");
const test1Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "John Doe",
    date: "2025-01-01",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E001",
    employeeName: "John Doe",
    date: "2025-01-02",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E001",
    employeeName: "John Doe",
    date: "2025-01-03",
    attendanceStatus: "full_day",
  },
];
const test1Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1000,
  test1Data,
);
assertEqual(test1Result.length, 1, "Should have 1 employee");
assertEqual(test1Result[0].attendanceDays, 3, "Should have 3 full days");
assertEqual(test1Result[0].basePay, 3000, "Base pay should be 3000");
assertEqual(test1Result[0].netPay, 3000, "Net pay should be 3000");

// Test 2: Mixed attendance statuses
console.log("\nTest 2: Mixed attendance statuses (full, half, absent)");
const test2Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "Jane Smith",
    date: "2025-01-01",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E001",
    employeeName: "Jane Smith",
    date: "2025-01-02",
    attendanceStatus: "half_day",
  },
  {
    employeeId: "E001",
    employeeName: "Jane Smith",
    date: "2025-01-03",
    attendanceStatus: "absent",
  },
  {
    employeeId: "E001",
    employeeName: "Jane Smith",
    date: "2025-01-04",
    attendanceStatus: "full_day",
  },
];
const test2Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1000,
  test2Data,
);
assertEqual(test2Result[0].attendanceDays, 2, "Should have 2 full days");
assertEqual(test2Result[0].halfDays, 1, "Should have 1 half day");
assertEqual(test2Result[0].absentDays, 1, "Should have 1 absent day");
assertEqual(
  test2Result[0].basePay,
  2500,
  "Base pay should be 2500 (2*1000 + 0.5*1000)",
);
assertEqual(test2Result[0].netPay, 2500, "Net pay should be 2500");

// Test 3: Multiple employees
console.log("\nTest 3: Multiple employees");
const test3Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "Alice",
    date: "2025-01-01",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E001",
    employeeName: "Alice",
    date: "2025-01-02",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E002",
    employeeName: "Bob",
    date: "2025-01-01",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E002",
    employeeName: "Bob",
    date: "2025-01-02",
    attendanceStatus: "half_day",
  },
  {
    employeeId: "E002",
    employeeName: "Bob",
    date: "2025-01-03",
    attendanceStatus: "half_day",
  },
];
const test3Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1000,
  test3Data,
);
assertEqual(test3Result.length, 2, "Should have 2 employees");
const alice = test3Result.find((e) => e.employeeId === "E001")!;
const bob = test3Result.find((e) => e.employeeId === "E002")!;
assertEqual(alice.basePay, 2000, "Alice base pay should be 2000");
assertEqual(bob.basePay, 2000, "Bob base pay should be 2000 (1*1000 + 2*500)");

// Test 4: Decimal base pay
console.log("\nTest 4: Decimal base pay");
const test4Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "Test User",
    date: "2025-01-01",
    attendanceStatus: "full_day",
  },
  {
    employeeId: "E001",
    employeeName: "Test User",
    date: "2025-01-02",
    attendanceStatus: "half_day",
  },
];
const test4Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1234.56,
  test4Data,
);
assertEqual(test4Result[0].basePay, 1851.84, "Base pay should be 1851.84");
assertEqual(test4Result[0].netPay, 1851.84, "Net pay should be 1851.84");

// Test 5: All absent days
console.log("\nTest 5: All absent days");
const test5Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "Absent User",
    date: "2025-01-01",
    attendanceStatus: "absent",
  },
  {
    employeeId: "E001",
    employeeName: "Absent User",
    date: "2025-01-02",
    attendanceStatus: "absent",
  },
];
const test5Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1000,
  test5Data,
);
assertEqual(test5Result[0].attendanceDays, 0, "Should have 0 full days");
assertEqual(test5Result[0].halfDays, 0, "Should have 0 half days");
assertEqual(test5Result[0].absentDays, 2, "Should have 2 absent days");
assertEqual(test5Result[0].basePay, 0, "Base pay should be 0");
assertEqual(test5Result[0].netPay, 0, "Net pay should be 0");

// Test 6: Rounding to 2 decimal places
console.log("\nTest 6: Rounding to 2 decimal places");
const test6Data: AttendanceData[] = [
  {
    employeeId: "E001",
    employeeName: "Test",
    date: "2025-01-01",
    attendanceStatus: "half_day",
  },
];
const test6Result = generatePayroll(
  "2025-01-01",
  "2025-01-31",
  1000 / 3,
  test6Data,
);
// Note: basePayPerDay is not rounded in the function (used as-is)
assertEqual(
  Math.round(test6Result[0].basePayPerDay * 100) / 100,
  333.33,
  "Base pay per day rounds to 333.33",
);
assertEqual(
  test6Result[0].basePay,
  166.67,
  "Base pay should be 166.67 (333.33 * 0.5)",
);

// Summary
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}
