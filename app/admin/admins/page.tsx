import { getAllAdmins, getCurrentAdminId } from "@/actions/auth";
import { TopNav } from "@/components/layout/TopNav";
import { AdminList } from "./AdminList";

export default async function AdminsPage() {
  const admins = await getAllAdmins();
  const currentAdminId = await getCurrentAdminId();

  return (
    <div className="pt-20 pb-12 md:pb-10">
      <TopNav />
      <AdminList admins={admins} currentAdminId={currentAdminId} />
    </div>
  );
}
