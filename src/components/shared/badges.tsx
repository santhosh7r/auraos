import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  Priority, TaskStatus, ProjectStatus, ClientHealth, LeadStatus, InvoiceStatus,
} from "@/lib/types";
import { TASK_STATUSES, PROJECT_STAGES, LEAD_STAGES } from "@/lib/types";
import { ArrowDown, ArrowUp, Minus, ChevronsUp } from "lucide-react";

// Priority is a single mild tone everywhere; the icon (down/flat/up/double-up)
// communicates the level, not colour.
const PRIORITY_CLS = "text-muted-foreground";
const PRIORITY_MAP: Record<Priority, { label: string; cls: string; icon: React.ReactNode }> = {
  low: { label: "Low", cls: PRIORITY_CLS, icon: <ArrowDown className="size-3" /> },
  medium: { label: "Medium", cls: PRIORITY_CLS, icon: <Minus className="size-3" /> },
  high: { label: "High", cls: PRIORITY_CLS, icon: <ArrowUp className="size-3" /> },
  urgent: { label: "Urgent", cls: PRIORITY_CLS, icon: <ChevronsUp className="size-3" /> },
};

export function PriorityBadge({ priority, showLabel = true }: { priority: Priority; showLabel?: boolean }) {
  const p = PRIORITY_MAP[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", p.cls)}>
      {p.icon}
      {showLabel && p.label}
    </span>
  );
}

export function HealthDot({ health, className }: { health: ClientHealth; className?: string }) {
  const map = { green: "bg-success", yellow: "bg-warning", red: "bg-destructive" };
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("size-2 rounded-full", map[health])} />
    </span>
  );
}

export function HealthBadge({ health }: { health: ClientHealth }) {
  const map = {
    green: { v: "success" as const, label: "Healthy" },
    yellow: { v: "warning" as const, label: "At Risk" },
    red: { v: "destructive" as const, label: "Critical" },
  };
  const m = map[health];
  return (
    <Badge variant={m.v}>
      <span className={cn("mr-0.5 size-1.5 rounded-full",
        health === "green" ? "bg-success" : health === "yellow" ? "bg-warning" : "bg-destructive")} />
      {m.label}
    </Badge>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = TASK_STATUSES.find((x) => x.id === status)!;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className="size-2 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const s = PROJECT_STAGES.find((x) => x.id === status)!;
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const s = LEAD_STAGES.find((x) => x.id === status)!;
  return (
    <Badge variant="secondary" className="gap-1.5">
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const map: Record<InvoiceStatus, { v: Parameters<typeof Badge>[0]["variant"]; label: string }> = {
    draft: { v: "muted", label: "Draft" },
    sent: { v: "default", label: "Sent" },
    paid: { v: "success", label: "Paid" },
    overdue: { v: "destructive", label: "Overdue" },
  };
  const m = map[status];
  return <Badge variant={m.v}>{m.label}</Badge>;
}

export function ScorePill({ score }: { score: number }) {
  const variant = score >= 80 ? "success" : score >= 50 ? "warning" : "muted";
  return <Badge variant={variant}>{score}</Badge>;
}
