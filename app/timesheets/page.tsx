import { TopNav } from "@/components/TopNav";
import { TimesheetUpload } from "@/components/TimesheetUpload";

export default function TimesheetsPage() {
  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <TimesheetUpload />
    </div>
  );
}
