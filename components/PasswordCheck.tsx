"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { checkPasswordStatus } from "@/actions/auth";

export function PasswordCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      if (pathname === "/admin/password") {
        setLoading(false);
        return;
      }

      try {
        const { mustChange } = await checkPasswordStatus();
        if (mustChange) {
          router.push("/admin/password");
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    };
    check();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
