import { TopNav } from "@/components/layout/TopNav";
import { TimesheetUpload } from "@/components/timesheets/TimesheetUpload";

export default function TimesheetsPage() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <TimesheetUpload />
    </div>
  );
}
