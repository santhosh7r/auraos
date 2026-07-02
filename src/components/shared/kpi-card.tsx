"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Sparkline } from "@/components/charts/charts";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaSuffix?: string;
  icon: LucideIcon;
  spark?: number[];
  accent?: string; // retained for API compatibility; not used decoratively
  index?: number;
  hint?: string;
}

export function KpiCard({
  label, value, delta, deltaSuffix = "vs last month", icon: Icon, spark, index = 0, hint,
}: KpiCardProps) {
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
        {spark ? (
          <div className="mt-3 -mb-1">
            <Sparkline data={spark} color="hsl(var(--brand))" />
          </div>
        ) : (
          <div className="mt-2.5 flex items-center gap-1.5 text-[12px]">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", positive ? "text-muted-foreground" : "text-destructive")}>
                {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {Math.abs(delta).toFixed(1)}%
              </span>
            )}
            <span className="truncate text-muted-foreground/70">{hint ?? deltaSuffix}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
