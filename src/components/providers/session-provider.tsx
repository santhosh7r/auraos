"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Role, SessionUser } from "@/lib/types";
import { capabilities, type Capabilities } from "@/lib/rbac";

interface SessionState {
  user: SessionUser;
  role: Role;
  caps: Capabilities;
  logout: () => Promise<void>;
}

const SessionContext = React.createContext<SessionState | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const logout = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  const value = React.useMemo<SessionState>(
    () => ({ user, role: user.role, caps: capabilities(user.role), logout }),
    [user, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
