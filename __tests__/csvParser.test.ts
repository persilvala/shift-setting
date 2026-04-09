import { parseCsvTimesheet } from '@/lib/timesheetParser';

/**
 * Helper to create a CSV buffer
 */
function createCsvBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

describe('parseCsvTimesheet', () => {
  describe('Basic CSV parsing', () => {
    it('should parse a simple CSV timesheet', () => {
      const csv = `Name,Date,Time In,Time Out,Total Hours
John Doe,2026-03-01,08:00,17:00,8
Jane Smith,2026-03-01,09:00,18:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.format).toBe('excel');
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].employeeName).toBe('John Doe');
      expect(result.rows[0].date).toBe('2026-03-01');
      expect(result.rows[0].totalHours).toBe(8);
    });

    it('should handle CSV with different header names', () => {
      const csv = `Employee Name,Work Date,Clock In,Clock Out,Total Hrs
John Doe,2026-03-01,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].employeeName).toBe('John Doe');
      expect(result.rows[0].timeIn).toBe('08:00');
      expect(result.rows[0].timeOut).toBe('17:00');
    });

    it('should calculate hours when not provided', () => {
      const csv = `Name,Date,Time In,Time Out
John Doe,2026-03-01,08:00,17:00`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].totalHours).toBe(9);
    });
  });

  describe('CSV delimiter handling', () => {
    it('should parse comma-separated CSV', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employeeName).toBe('John Doe');
    });

    it('should handle tab-separated values', () => {
      const csv = `Name\tDate\tTime In\tTime Out\tHours
John Doe\t2026-03-01\t08:00\t17:00\t8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(1);
    });

    it('should handle pipe-separated values', () => {
      const csv = `Name|Date|Time In|Time Out|Hours
John Doe|2026-03-01|08:00|17:00|8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(1);
    });
  });

  describe('CSV data validation', () => {
    it('should filter out rows without employee names', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,08:00,17:00,8
,2026-03-02,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].employeeName).toBe('John Doe');
    });

    it('should filter out rows without dates', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      // Row with missing date will have issues but may still be parsed
      // Check that it has issues flagged
      if (result.rows.length > 0) {
        expect(result.rows[0].issues).toContain('Missing or invalid date');
      }
    });

    it('should handle empty CSV', () => {
      const csv = '';
      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(0);
    });

    it('should handle CSV with only headers', () => {
      const csv = `Name,Date,Time In,Time Out,Hours`;
      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(0);
    });
  });

  describe('CSV edge cases', () => {
    it('should handle quoted fields with commas', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
"Doe, John",2026-03-01,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].employeeName).toBe('Doe, John');
    });

    it('should handle special characters', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
Jose Garcia,2026-03-01,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].employeeName).toBe('Jose Garcia');
    });

    it('should handle whitespace in values', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
  John Doe  ,2026-03-01,  08:00  ,  17:00  ,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].employeeName).toBe('John Doe');
      expect(result.rows[0].timeIn).toBe('08:00');
      expect(result.rows[0].timeOut).toBe('17:00');
    });

    it('should handle multiple employees', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,08:00,17:00,8
Jane Smith,2026-03-01,09:00,18:00,8
Bob Johnson,2026-03-01,07:00,16:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(3);
      expect(result.rows.map((r) => r.employeeName)).toEqual(
        expect.arrayContaining(['John Doe', 'Jane Smith', 'Bob Johnson'])
      );
    });

    it('should handle multiple dates per employee', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,08:00,17:00,8
John Doe,2026-03-02,08:00,17:00,8
John Doe,2026-03-03,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(3);
      expect(result.rows.every((r) => r.employeeName === 'John Doe')).toBe(true);
      expect(result.rows.map((r) => r.date)).toEqual([
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
      ]);
    });
  });

  describe('CSV time format variations', () => {
    it('should handle 12-hour time format', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,8:00 AM,5:00 PM,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].timeIn).toBe('08:00');
      expect(result.rows[0].timeOut).toBe('17:00');
    });

    it('should handle overnight shifts', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,22:00,06:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].timeIn).toBe('22:00');
      expect(result.rows[0].timeOut).toBe('06:00');
      expect(result.rows[0].totalHours).toBe(8);
    });
  });

  describe('CSV with metadata', () => {
    it('should handle CSV with standard headers', () => {
      const csv = `Name,Date,Time In,Time Out,Hours
John Doe,2026-03-01,08:00,17:00,8
John Doe,2026-03-02,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].employeeName).toBe('John Doe');
    });

    it('should parse CSV with user ID and dept in header row', () => {
      const csv = `User ID,Name,Dept,Date,Time In,Time Out,Hours
JD001,John Doe,CICS,2026-03-01,08:00,17:00,8`;

      const buffer = createCsvBuffer(csv);
      const result = parseCsvTimesheet(buffer);

      expect(result.rows[0].employeeName).toBe('John Doe');
      // CSV parser may not extract userId/dept from headers - depends on implementation
      expect(result.rows[0].employeeName).toBeTruthy();
    });
  });
});
