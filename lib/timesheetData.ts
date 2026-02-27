export type TimesheetRow = {
  id: string;
  name: string;
  dept: string;
  calendar: string;
  hours: number;
  overtimeHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  status: "Clean" | "Attention";
  week: {
    Mo: number;
    Tu: number;
    We: number;
    Th: number;
    Fr: number;
    Sa: number;
    Su: number;
  };
};

export const dateRange = "2026-02-01 ~ 2026-03-31";

export const timesheetRows: TimesheetRow[] = [
  {
    id: "1",
    name: "Percy",
    dept: "CICS",
    calendar: "08:00 - 17:00 (Mon/Tue/Thu/Fri), 13:00 - 17:00 (Wed)",
    hours: 40,
    overtimeHours: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    status: "Clean",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
  {
    id: "2",
    name: "Dan",
    dept: "CICS",
    calendar: "08:00 - 17:00 (Mon-Fri)",
    hours: 40,
    overtimeHours: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    status: "Attention",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
  {
    id: "3",
    name: "Lanz",
    dept: "CICS",
    calendar: "08:00 - 17:00 (Mon-Fri)",
    hours: 40,
    overtimeHours: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    status: "Clean",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
  {
    id: "4",
    name: "Joshaiah",
    dept: "CICS",
    calendar: "08:00 - 17:00 (Mon-Fri)",
    hours: 40,
    overtimeHours: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    status: "Clean",
    week: { Mo: 1, Tu: 1, We: 1, Th: 1, Fr: 1, Sa: 0, Su: 0 },
  },
];
