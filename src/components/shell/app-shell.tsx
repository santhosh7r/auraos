"use client";

import * as React from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPaletteProvider } from "@/components/shell/command-palette";
import { useCurrency } from "@/components/providers/currency-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currency } = useCurrency();

  // Presence heartbeat — keeps lastActiveAt fresh so Team shows who's online.
  React.useEffect(() => {
    const beat = () => void fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    beat();
    const id = setInterval(beat, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <CommandPaletteProvider>
      {/* Fixed shell — only <main> scrolls; sidebar + topbar never move. */}
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-10">
            {/* re-mount on currency change so every amount reformats */}
            <div key={currency} className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
