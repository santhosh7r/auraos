"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

/**
 * The single, engineered metric card used across every page.
 * Monochrome surface, 16px icon top-right, large number, optional trend/hint.
 * Matches the Finance / Invoices language.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  delta?: number;
  index?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03, ease: "easeOut" }}
    >
      <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-[hsl(0_0%_23%)]">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground/50" strokeWidth={1.9} />
        </div>
        <p className="mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
        {(hint || delta !== undefined) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[12px]">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-muted-foreground" : "text-destructive")}>
                {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(delta)}%
              </span>
            )}
            {hint && <span className="truncate text-muted-foreground/70">{hint}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
