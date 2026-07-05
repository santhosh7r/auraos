import type { Role } from "./types";
import {
  LayoutDashboard, Contact2, Building2, FolderKanban, ListTodo,
  Calendar, CalendarRange, Users, Wallet, Receipt, BarChart3, Settings, SlidersHorizontal,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard" | "leaderboard" | "leads" | "clients" | "projects" | "tasks" | "calendar" | "content"
  | "finance" | "invoices" | "reports" | "team" | "config" | "settings";

export type NavGroup = "Overview" | "Clients" | "Delivery" | "Finance" | "Company";

export interface NavItem {
  key: NavKey;
  label: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Overview", href: "/dashboard", icon: LayoutDashboard, group: "Overview" },
  { key: "leaderboard", label: "Leaderboard", href: "/leaderboard", icon: Trophy, group: "Overview" },

  { key: "leads", label: "Leads", href: "/leads", icon: Contact2, group: "Clients" },
  { key: "clients", label: "Clients", href: "/clients", icon: Building2, group: "Clients" },

  { key: "projects", label: "Projects", href: "/projects", icon: FolderKanban, group: "Delivery" },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: ListTodo, group: "Delivery" },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: Calendar, group: "Delivery" },
  { key: "content", label: "Content", href: "/content", icon: CalendarRange, group: "Delivery" },

  { key: "finance", label: "Finance", href: "/finance", icon: Wallet, group: "Finance" },
  { key: "invoices", label: "Invoices", href: "/invoices", icon: Receipt, group: "Finance" },

  { key: "reports", label: "Reports", href: "/reports", icon: BarChart3, group: "Company" },
  { key: "team", label: "Team", href: "/team", icon: Users, group: "Company" },
  { key: "config", label: "Config", href: "/config", icon: SlidersHorizontal, group: "Company" },
  { key: "settings", label: "Settings", href: "/settings", icon: Settings, group: "Company" },
];

const ALL: NavKey[] = NAV_ITEMS.map((i) => i.key);

/** Valid nav keys (used to sanitize stored per-role page overrides). */
export const NAV_KEYS: NavKey[] = ALL;

/**
 * Default page visibility per built-in role. Admins can override these (and set
 * pages for custom roles) on the Config page; overrides are stored as
 * `pages:<role>` settings and merged on top of these defaults at runtime.
 */
export const ROLE_PAGE_DEFAULTS: Record<Role, NavKey[]> = {
  admin: ALL,
  manager: ["dashboard", "leaderboard", "leads", "clients", "projects", "tasks", "calendar", "content", "reports", "team", "settings"],
  sales: ["dashboard", "leaderboard", "leads", "clients", "tasks", "calendar", "reports", "settings"],
  finance: ["dashboard", "leaderboard", "clients", "projects", "finance", "invoices", "reports", "settings"],
  developer: ["dashboard", "leaderboard", "projects", "tasks", "calendar", "settings"],
  designer: ["dashboard", "leaderboard", "projects", "tasks", "calendar", "content", "settings"],
  marketing: ["dashboard", "leaderboard", "leads", "tasks", "calendar", "content", "reports", "settings"],
};

/** Fallback page set for unknown / custom roles. */
export const CUSTOM_ROLE_DEFAULT_PAGES: NavKey[] = ["dashboard", "leaderboard", "content", "settings"];

/** Resolve the page keys for a role, given optional stored overrides (`pages:<role>` values). */
export function pagesForRole(role: string, override?: string[]): NavKey[] {
  if (Array.isArray(override) && override.length) {
    return NAV_KEYS.filter((k) => override.includes(k));
  }
  return ROLE_PAGE_DEFAULTS[role as Role] ?? CUSTOM_ROLE_DEFAULT_PAGES;
}

/** Filter NAV_ITEMS down to a set of page keys, preserving display order. */
export function navFromPages(keys: NavKey[] | string[]): NavItem[] {
  const allowed = new Set(keys);
  return NAV_ITEMS.filter((i) => allowed.has(i.key));
}

/** Static nav for a built-in role — SSR fallback before config loads. */
export function navForRole(role: Role): NavItem[] {
  return navFromPages(pagesForRole(role));
}

export function canSee(role: Role, key: NavKey): boolean {
  return pagesForRole(role).includes(key);
}

export interface Capabilities {
  viewFinance: boolean;
  manageTeam: boolean;
  manageClients: boolean;
  manageProjects: boolean;
  manageLeads: boolean;
  manageSettings: boolean;
  manageContent: boolean;
  generateInvoice: boolean;
}

export function capabilities(role: Role): Capabilities {
  const admin = role === "admin";
  return {
    viewFinance: admin || role === "finance",
    manageTeam: admin,
    manageClients: admin || role === "manager" || role === "sales",
    manageProjects: admin || role === "manager",
    manageLeads: admin || role === "sales" || role === "marketing",
    manageSettings: admin,
    manageContent: admin || role === "manager" || role === "marketing" || role === "designer",
    generateInvoice: admin || role === "finance",
  };
}

export const DEFAULT_HOME = "/dashboard";
