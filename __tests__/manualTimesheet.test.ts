import { validateManualRows } from '@/lib/manualTimesheet';

describe('manual timesheet validation', () => {
  it('rejects rows missing required fields', () => {
    const result = validateManualRows([
      { employeeName: '', dept: '', date: '', timeIn: null, timeOut: null, totalHours: null },
    ] as any);

    expect(result.ok).toBe(false);
    expect(result.errors?.join(' ')).toContain('Employee name is required');
    expect(result.errors?.join(' ')).toContain('Department is required');
    expect(result.errors?.join(' ')).toContain('Date is required');
  });

  it('rejects duplicate dates per employee', () => {
    const result = validateManualRows([
      { employeeName: 'Alice', dept: 'Ops', date: '2026-03-01', timeIn: '08:00', timeOut: '17:00', totalHours: 8 },
      { employeeName: 'Alice', dept: 'Ops', date: '2026-03-01', timeIn: '08:30', timeOut: '12:00', totalHours: 4 },
    ] as any);

    expect(result.ok).toBe(false);
    expect(result.errors?.join(' ')).toContain('Duplicate date');
  });

  it('allows absent rows without time values and computes date range', () => {
    const result = validateManualRows([
      { employeeName: 'Bob', dept: 'IT', date: '2026-03-02', attendanceStatus: 'absent' },
    ] as any);

    expect(result.ok).toBe(true);
    expect(result.rows?.[0].timeIn).toBeNull();
    expect(result.rows?.[0].totalHours).toBeNull();
    expect(result.startDate?.toISOString().slice(0, 10)).toBe('2026-03-02');
    expect(result.endDate?.toISOString().slice(0, 10)).toBe('2026-03-02');
  });

  it('accepts valid rows and returns normalized data', () => {
    const result = validateManualRows([
      { employeeName: 'Cara', dept: 'HR', date: '2026-03-03', timeIn: '09:00', timeOut: '17:00', totalHours: 8 },
    ] as any);

    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows?.[0].employeeName).toBe('Cara');
    expect(result.rows?.[0].attendanceStatus).toBe('full_day');
    expect(result.startDate?.toISOString().slice(0, 10)).toBe('2026-03-03');
  });
});
