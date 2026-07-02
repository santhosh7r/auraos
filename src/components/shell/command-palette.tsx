"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { useAppConfig } from "@/components/providers/config-provider";
import { Moon, Sun, ArrowRight, User, LogOut } from "lucide-react";

interface Ctx { open: boolean; setOpen: (o: boolean) => void; toggle: () => void }
const CommandCtx = React.createContext<Ctx | null>(null);
export const useCommandPalette = () => {
  const c = React.useContext(CommandCtx);
  if (!c) throw new Error("useCommandPalette outside provider");
  return c;
};

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { role, logout } = useSession();
  const { members } = useTeam();
  const { navFor } = useAppConfig();
  const { setTheme, theme } = useTheme();
  const nav = navFor(role);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <CommandCtx.Provider value={{ open, setOpen, toggle: () => setOpen((o) => !o) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or jump to…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {nav.map((item) => (
              <CommandItem key={item.key} onSelect={() => go(item.href)}>
                <item.icon /> {item.label}
                <ArrowRight className="ml-auto opacity-0 group-data-[selected=true]:opacity-100" />
              </CommandItem>
            ))}
          </CommandGroup>

          {members.length > 0 && (
            <CommandGroup heading="Team">
              {members.slice(0, 6).map((m) => (
                <CommandItem key={m.id} value={`team ${m.name} ${m.email}`} onSelect={() => go("/team")}>
                  <User /> {m.name} <span className="text-muted-foreground">· {m.title || m.role}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setTheme(theme === "dark" ? "light" : "dark"); setOpen(false); }}>
              {theme === "dark" ? <Sun /> : <Moon />} Toggle {theme === "dark" ? "light" : "dark"} mode
            </CommandItem>
            <CommandItem onSelect={() => { setOpen(false); void logout(); }}>
              <LogOut /> Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </CommandCtx.Provider>
  );
}
