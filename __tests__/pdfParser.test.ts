import { parsePdfTimesheet } from '@/lib/timesheetParser';

/**
 * Helper to create a mock PDF buffer
 * Note: Actual PDF parsing requires pdf-parse which needs real PDF files
 * These tests use mocked text extraction
 */
describe('parsePdfTimesheet', () => {
  describe('Attendance Table PDF parsing', () => {
    it('should parse attendance table format from PDF', async () => {
      // Mock PDF text content
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS
Date: 2026-03-01 ~ 2026-03-31

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out  Overtime In  Overtime Out
1 Mo          08:00           12:00            13:00          17:00
2 Tu          08:00           12:00            13:00          17:00
3 We          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      expect(result.format).toBe('pdf');
      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.rows[0].employeeName).toBe('John Doe');
      expect(result.rows[0].userId).toBe('JD001');
      expect(result.rows[0].dept).toBe('CICS');
      expect(result.rows[0].template).toBe('attendance-table');
    });

    it('should extract date range from PDF header', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001
Date: 2026-03-01 ~ 2026-03-31

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      expect(result.startDate).toBe('2026-03-01');
      expect(result.endDate).toBe('2026-03-31');
    });

    it('should parse weekday and day number from PDF rows', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS
Date: 2026-03-01 ~ 2026-03-07

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          08:00           12:00            13:00          17:00
2 Tu          08:00           12:00            13:00          17:00
3 We          08:00           12:00            13:00          17:00
4 Th          08:00           12:00            13:00          17:00
5 Fr          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      expect(result.rows.length).toBe(5);
      expect(result.rows.map((r) => r.weekday)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr']);
      expect(result.rows.map((r) => r.date)).toEqual([
        '2026-03-01',
        '2026-03-02',
        '2026-03-03',
        '2026-03-04',
        '2026-03-05',
      ]);
    });

    it('should calculate total hours from time blocks', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS
Date: 2026-03-01 ~ 2026-03-07

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      // 4 hours before noon + 4 hours after noon = 8 hours
      expect(result.rows[0].totalHours).toBe(8);
    });

    it('should include overtime hours in calculation', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS
Date: 2026-03-01 ~ 2026-03-07

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out  Overtime In  Overtime Out
1 Mo          08:00           12:00            13:00          17:00           18:00        20:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      // 4 + 4 + 2 = 10 hours
      expect(result.rows[0].totalHours).toBe(10);
      expect(result.rows[0].overtimeIn).toBe('18:00');
      expect(result.rows[0].overtimeOut).toBe('20:00');
    });
  });

  describe('PDF edge cases', () => {
    it('should return empty result for empty PDF', async () => {
      const pdfContent = Buffer.from('');
      const result = await parsePdfTimesheet(pdfContent);

      expect(result.format).toBe('pdf');
      expect(result.rows).toHaveLength(0);
      expect(result.warnings).toContain('PDF contains no text');
    });

    it('should return empty result for unrecognized PDF format', async () => {
      const pdfContent = Buffer.from('This is not a timesheet PDF');
      const result = await parsePdfTimesheet(pdfContent);

      expect(result.format).toBe('pdf');
      expect(result.rows).toHaveLength(0);
    });

    it('should handle PDF with missing date range', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      expect(result.warnings).toContain('Missing date range start');
    });

    it('should handle PDF with missing employee name', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Date: 2026-03-01 ~ 2026-03-07

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          08:00           12:00            13:00          17:00
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      // Should not parse rows without a valid employee name
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('PDF time format variations', () => {
    it('should handle various time formats', async () => {
      const pdfContent = Buffer.from(`
Employee Attendance Table
Name: John Doe          User ID: JD001         Dept: CICS
Date: 2026-03-01 ~ 2026-03-07

Date/Weekday  Before Noon In  Before Noon Out  After Noon In  After Noon Out
1 Mo          8:00          12:00            1:00 PM        5:00 PM
      `.trim());

      const result = await parsePdfTimesheet(pdfContent);

      expect(result.rows[0].beforeNoonIn).toBe('08:00');
      expect(result.rows[0].beforeNoonOut).toBe('12:00');
      expect(result.rows[0].afterNoonIn).toBe('13:00');
      expect(result.rows[0].afterNoonOut).toBe('17:00');
    });
  });
});
