"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/components/providers/session-provider";
import { useCurrency } from "@/components/providers/currency-provider";
import { useCommandPalette } from "@/components/shell/command-palette";
import type { Currency } from "@/lib/utils";
import { MobileNav } from "@/components/shell/mobile-nav";
import { ROLE_LABELS, type AppNotification } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";
import {
  Search, Moon, Sun, Bell, Menu, LogOut, Settings, UserCircle,
} from "lucide-react";

export function Topbar() {
  const { toggle } = useCommandPalette();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
      {/* Mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <MobileNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Spotlight search */}
      <button
        onClick={toggle}
        className="group hidden h-9 max-w-md flex-1 items-center gap-2.5 rounded-lg border border-border bg-secondary/60 px-3 text-sm text-muted-foreground transition-colors hover:border-[hsl(0_0%_23%)] md:flex"
      >
        <Search className="size-4" />
        <span>Search or jump to…</span>
        <kbd className="ml-auto inline-flex h-5 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 font-sans text-[11px] font-medium text-muted-foreground">
          <span className="text-[13px] leading-none">⌘</span>K
        </kbd>
      </button>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={toggle} className="md:hidden" aria-label="Search">
          <Search className="size-[18px]" />
        </Button>
        <CurrencyToggle />
        <ThemeToggle />
        <NotificationsMenu />
        <div className="mx-1 hidden h-7 w-px bg-border/70 sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}

function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  const options: Currency[] = ["USD", "INR"];
  return (
    <div className="hidden items-center gap-0.5 rounded-lg border border-border bg-secondary/60 p-0.5 sm:flex">
      {options.map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-[13px] font-medium transition-colors",
            currency === c ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {c === "USD" ? "$" : "₹"}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} aria-label="Toggle theme">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mounted && isDark ? "sun" : "moon"}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {mounted && isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

function NotificationsMenu() {
  const router = useRouter();
  const [items, setItems] = React.useState<AppNotification[]>([]);
  // Live: load on mount + poll, and refresh when the tab regains focus.
  React.useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/r/notifications")
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((j) => { if (active) setItems(j.data ?? []); })
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { active = false; clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, []);
  const unread = items.filter((n) => !n.read).length;

  function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void fetch(`/api/r/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {});
  }

  function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void Promise.all(
      unreadIds.map((id) =>
        fetch(`/api/r/notifications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        }).catch(() => {})
      )
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold">
            Notifications
            {unread > 0 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({unread} new)</span>}
          </p>
          {unread > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); markAllRead(); }}
              className="text-xs font-medium text-brand transition-colors hover:text-brand/80"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => { markRead(n.id); if (n.href) router.push(n.href); }}
              className="flex w-full gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand")} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm", n.read ? "font-normal text-muted-foreground" : "font-medium")}>{n.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{relativeTime(n.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem onClick={() => router.push("/notifications")} className="justify-center text-sm font-medium text-brand">
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, role, logout } = useSession();
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center rounded-full ring-2 ring-transparent transition-all hover:ring-border focus-visible:outline-none focus-visible:ring-ring">
          <UserAvatar name={user.name} src={user.avatar} className="size-9" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2 py-2">
          <UserAvatar name={user.name} src={user.avatar} className="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <span className="mx-2 mb-1 inline-flex rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          {ROLE_LABELS[role]}
        </span>
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
