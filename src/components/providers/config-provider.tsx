"use client";

import * as React from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/types";
import { navFromPages, pagesForRole, type NavItem, type NavKey } from "@/lib/rbac";

type Config = Record<string, string[]>;

interface ConfigState {
  config: Config;
  loading: boolean;
  /** Built-in roles followed by any custom roles defined in config. */
  roles: string[];
  /** Display label for a role (built-in mapping, else title-cased slug). */
  roleLabel: (role: string) => string;
  /** Allowed page keys for a role, honoring stored overrides. */
  pagesFor: (role: string) => NavKey[];
  /** Nav items for a role, honoring stored overrides. */
  navFor: (role: string) => NavItem[];
  refresh: () => Promise<void>;
}

const ConfigContext = React.createContext<ConfigState | null>(null);

export function titleCaseRole(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse "slug=Label" entries into a lookup map. */
export function parseRoleLabels(entries?: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of entries ?? []) {
    const i = s.indexOf("=");
    if (i > 0) {
      const slug = s.slice(0, i).trim();
      const label = s.slice(i + 1).trim();
      if (slug && label) map[slug] = label;
    }
  }
  return map;
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<Config>({});
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const json = await res.json().catch(() => ({ data: {} }));
      if (res.ok) setConfig(json.data ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const roles = React.useMemo(() => {
    const removed = new Set(Array.isArray(config.removedRoles) ? config.removedRoles : []);
    const custom = Array.isArray(config.roles) ? config.roles : [];
    const builtins = ROLES.filter((r) => r === "admin" || !removed.has(r));
    return [...builtins, ...custom.filter((r) => !ROLES.includes(r as Role))];
  }, [config.roles, config.removedRoles]);

  const labelOverrides = React.useMemo(
    () => parseRoleLabels(config.roleLabels),
    [config.roleLabels]
  );

  const roleLabel = React.useCallback(
    (role: string) => labelOverrides[role] ?? ROLE_LABELS[role as Role] ?? titleCaseRole(role),
    [labelOverrides]
  );

  const pagesFor = React.useCallback(
    (role: string) => pagesForRole(role, config[`pages:${role}`]),
    [config]
  );

  const navFor = React.useCallback(
    (role: string) => navFromPages(pagesFor(role)),
    [pagesFor]
  );

  const value = React.useMemo<ConfigState>(
    () => ({ config, loading, roles, roleLabel, pagesFor, navFor, refresh }),
    [config, loading, roles, roleLabel, pagesFor, navFor, refresh]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = React.useContext(ConfigContext);
  if (!ctx) throw new Error("useAppConfig must be used within ConfigProvider");
  return ctx;
}
