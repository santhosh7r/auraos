"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { useAppConfig } from "@/components/providers/config-provider";
import { type NavGroup, type NavItem } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/types";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PanelLeftClose, PanelLeft, ChevronsUpDown, LogOut, Settings,
  UserCircle,
} from "lucide-react";

const GROUP_ORDER: NavGroup[] = ["Overview", "Clients", "Delivery", "Finance", "Company"];
const STORAGE_KEY = "aura.sidebar.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useSession();
  const { navFor } = useAppConfig();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) setCollapsed(v === "1");
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  };

  const items = navFor(role);
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: items.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Brand + collapse */}
        <div className={cn("flex h-16 items-center gap-2.5 px-3", collapsed && "justify-center px-0")}>
          <Link href="/dashboard" className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
            <Image src="/logo.jpg" alt="Aura Digital Services" width={48} height={48} className="size-12 rounded-xl object-contain" priority />
          </Link>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
              Aura HQ
            </span>
          )}
          {!collapsed && (
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <PanelLeftClose className="size-[17px]" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3 no-scrollbar">
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  aria-label="Expand sidebar"
                  className="mx-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  <PanelLeft className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>Expand</TooltipContent>
            </Tooltip>
          )}
          {grouped.map((section) => (
            <div key={section.group}>
              {!collapsed && (
                <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/45">
                  {section.group}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavRow key={item.key} item={item} active={isActive(item.href)} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div className="border-t border-sidebar-border p-3">
          {!collapsed ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" />
                All systems operational
              </div>
              <UserCard collapsed={false} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="size-1.5 rounded-full bg-success" />
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>All systems operational</TooltipContent>
              </Tooltip>
              <UserCard collapsed />
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

function NavRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const row = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />
      )}
      <item.icon
        className={cn("size-[18px] shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}
        strokeWidth={1.9}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return row;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>{item.label}</TooltipContent>
    </Tooltip>
  );
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { user, role, logout } = useSession();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button className="rounded-full ring-2 ring-transparent transition-colors hover:ring-sidebar-border" aria-label="Account">
            <UserAvatar name={user.name} src={user.avatar} className="size-8" />
          </button>
        ) : (
          <button className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent">
            <UserAvatar name={user.name} src={user.avatar} className="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-tight">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{ROLE_LABELS[role]}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52">
        <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">{user.email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/team")}><UserCircle /> Team</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}><Settings /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()} className="text-destructive focus:text-destructive">
          <LogOut className="!text-destructive" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
