"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "@/components/providers/session-provider";
import { useAppConfig } from "@/components/providers/config-provider";

export function MobileNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { role } = useSession();
  const { navFor } = useAppConfig();
  const items = navFor(role);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span className="text-sm font-black">W</span>
        </div>
        <p className="text-sm font-bold">Aura</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-accent"
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
