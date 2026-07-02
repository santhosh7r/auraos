"use client";

import * as React from "react";
import type { TeamMember } from "@/lib/types";

interface TeamState {
  members: TeamMember[];
  loading: boolean;
  byId: (id: string) => TeamMember | undefined;
  refresh: () => Promise<void>;
}

const TeamContext = React.createContext<TeamState | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      const json = await res.json();
      if (res.ok) setMembers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = React.useCallback(
    (id: string) => members.find((m) => m.id === id),
    [members]
  );

  const value = React.useMemo(
    () => ({ members, loading, byId, refresh }),
    [members, loading, byId, refresh]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = React.useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}
