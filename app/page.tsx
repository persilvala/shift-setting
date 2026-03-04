import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasAuth = Boolean(cookieStore.get("demo-auth"));
  redirect(hasAuth ? "/dashboard" : "/login");
}
