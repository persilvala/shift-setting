import { PasswordCheck } from "@/components/PasswordCheck";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PasswordCheck>{children}</PasswordCheck>;
}
