"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/shared/badges";
import { SpotlightArea } from "@/components/charts/charts";
import {
  PROJECT_STAGES, LEAD_STAGES,
  type Project, type Task, type Lead, type Client, type Invoice, type AppNotification, type SeriesPoint,
} from "@/lib/types";
import { formatCurrency, formatDate, relativeTime, cn } from "@/lib/utils";
import {
  ArrowUpRight, ArrowDownRight, Plus, ArrowRight, CheckCircle2, Clock,
  AlertTriangle, Sparkles, FileText, Receipt, Target, Activity,
} from "lucide-react";

const RANGES = ["1W", "1M", "3M", "6M", "1Y"] as const;
type Range = (typeof RANGES)[number];

interface Stats {
  counts: { clients: number; activeClients: number; projects: number; activeProjects: number; tasks: number; openTasks: number; leads: number; team: number };
  projectsByStatus: Record<string, number>;
  leadsByStatus: Record<string, number>;
  clientHealth: Record<string, number>;
  avgProgress: number;
  openPipeline: number;
  wonValue: number;
  finance?: { revenue: number; outstanding: number; expenses: number; profit: number; invoicesByStatus: Record<string, number> };
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const j = await r.json();
  return (j.data ?? j) as T;
}

/* A dated value used to build a real time series. */
interface Dated { date: string; value: number }

const DAY_MS = 86400_000;

/** Time buckets (oldest → newest) ending today, for the selected range. */
function rangeBuckets(range: Range): { start: number; end: number; label: string }[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const span = (count: number, days: number, fmt: Intl.DateTimeFormatOptions) =>
    Array.from({ length: count }, (_, i) => {
      const start = todayStart - (count - 1 - i) * days * DAY_MS;
      return { start, end: start + days * DAY_MS, label: new Date(start).toLocaleDateString("en-US", fmt) };
    });

  if (range === "1W") return span(7, 1, { weekday: "short" });
  if (range === "1M") return span(10, 3, { month: "short", day: "numeric" });
  if (range === "3M") return span(12, 7, { month: "short", day: "numeric" });

  // 6M / 1Y — calendar months.
  const n = range === "6M" ? 6 : 12;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: d.getTime(), end: end.getTime(), label: d.toLocaleDateString("en-US", { month: "short" }) };
  });
}

/** Sum dated values into the range's buckets — the real series behind the chart. */
function bucketSeries(range: Range, items: Dated[]): SeriesPoint[] {
  const buckets = rangeBuckets(range);
  return buckets.map((b) => {
    let sum = 0;
    for (const it of items) {
      const t = new Date(it.date).getTime();
      if (!Number.isNaN(t) && t >= b.start && t < b.end) sum += it.value;
    }
    return { label: b.label, value: Math.round(sum) };
  });
}

/** Percent change between the last two buckets, or undefined when not meaningful. */
function seriesDelta(series: SeriesPoint[]): number | undefined {
  if (series.length < 2) return undefined;
  const last = Number(series[series.length - 1].value);
  const prev = Number(series[series.length - 2].value);
  if (!prev) return undefined;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

export default function CommandCenter() {
  const { user, caps } = useSession();
  const { byId } = useTeam();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [notes, setNotes] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState<Range>("6M");

  React.useEffect(() => {
    Promise.all([
      getJSON<Stats>("/api/stats"),
      getJSON<Project[]>("/api/r/projects"),
      getJSON<Task[]>("/api/r/tasks"),
      getJSON<Lead[]>("/api/r/leads"),
      getJSON<Client[]>("/api/r/clients"),
      getJSON<AppNotification[]>("/api/r/notifications"),
      // Invoices are finance-gated; only fetch when this user can see finance.
      caps.viewFinance ? getJSON<Invoice[]>("/api/r/invoices") : Promise.resolve([] as Invoice[]),
    ])
      .then(([s, p, t, l, c, n, inv]) => {
        setStats(s); setProjects(p); setTasks(t); setLeads(l); setClients(c); setNotes(n); setInvoices(inv);
      })
      .finally(() => setLoading(false));
  }, [caps.viewFinance]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const today = Date.now();

  // Founder focus: my open tasks, overdue first
  const myFocus = tasks
    .filter((t) => t.assignee === user.id && t.status !== "done")
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));

  // Delivery: active projects by nearest deadline
  const activeProjects = projects
    .filter((p) => p.status !== "completed")
    .sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
  const delayed = activeProjects.filter(
    (p) => p.deadline && new Date(p.deadline).getTime() < today
  );

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "—";

  const revenue = stats?.finance?.revenue ?? 0;
  const showFinance = caps.viewFinance && !!stats?.finance;

  // Real chart data: revenue = paid invoices by issue date; otherwise delivery
  // momentum = tasks completed over time. Both bucketed into the selected range.
  const series = React.useMemo(() => {
    const items: Dated[] = showFinance
      ? invoices
          .filter((i) => i.status === "paid")
          .map((i) => ({ date: i.issueDate, value: i.amount }))
      : tasks
          .filter((t) => t.status === "done")
          .map((t) => ({ date: t.dueDate, value: 1 }));
    return bucketSeries(range, items);
  }, [showFinance, invoices, tasks, range]);

  const revDelta = seriesDelta(series);

  // Quiet stat strip
  const strip = stats
    ? [
        showFinance && {
          label: "Revenue", value: formatCurrency(stats.finance!.revenue, { compact: true }),
          delta: revDelta, hint: "paid this quarter",
        },
        {
          label: "Open pipeline", value: formatCurrency(stats.openPipeline, { compact: true }),
          delta: undefined as number | undefined, hint: `${leads.filter((l) => !["won", "lost"].includes(l.status)).length} active leads`,
        },
        showFinance && {
          label: "Outstanding", value: formatCurrency(stats.finance!.outstanding, { compact: true }),
          delta: undefined as number | undefined, hint: "awaiting payment",
        },
        {
          label: "Active projects", value: String(stats.counts.activeProjects),
          delta: undefined as number | undefined, hint: `${stats.avgProgress}% avg progress`,
        },
        {
          label: "Needs attention", value: String(delayed.length + myFocus.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < today).length),
          delta: undefined as number | undefined, hint: "overdue items", danger: true,
        },
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-6">
      {/* Founder overview hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Everything happening inside your agency today.
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground/70">
            {new Date().toLocaleDateString("en-US", { weekday: "long" })} • {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/reports"><Activity className="size-4" /> Reports</Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/leads"><Plus className="size-4" /> New lead</Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-[360px] lg:col-span-2" />
            <Skeleton className="h-[360px]" />
          </div>
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {strip.map((s, i) => {
              const stat = s as { label: string; value: string; delta?: number; hint: string; danger?: boolean };
              return <Stat key={stat.label} {...stat} index={i} />;
            })}
          </div>

          {/* Revenue spotlight + Today's focus */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="overflow-hidden p-0 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-0">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Target className="size-4" />
                    </span>
                    {showFinance ? "Revenue" : "Delivery momentum"}
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-[34px] font-semibold leading-none tracking-tight tabular-nums">
                      {showFinance ? formatCurrency(revenue) : `${stats?.avgProgress ?? 0}%`}
                    </span>
                    {revDelta !== undefined && (
                      <span className={cn(
                        "mb-1 inline-flex items-center gap-1 text-sm font-medium",
                        revDelta >= 0 ? "text-muted-foreground" : "text-destructive"
                      )}>
                        {revDelta >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                        {Math.abs(revDelta)}%
                        <span className="text-muted-foreground/70">vs previous</span>
                      </span>
                    )}
                  </div>
                </div>
                <RangePills value={range} onChange={setRange} />
              </div>
              <div className="mt-2">
                <SpotlightArea data={series} currency={showFinance} height={250} />
              </div>
            </Card>

            <FocusColumn
              items={myFocus.slice(0, 6)}
              total={myFocus.length}
              today={today}
              projectName={projectName}
            />
          </div>

          {/* Projects timeline + activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Projects timeline</h2>
                  <p className="text-sm text-muted-foreground">
                    {activeProjects.length} active
                    {delayed.length > 0 && (
                      <span className="ml-1.5 text-warning">· {delayed.length} delayed</span>
                    )}
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link href="/projects">View all <ArrowRight className="size-3.5" /></Link>
                </Button>
              </div>
              <div className="space-y-1">
                {activeProjects.slice(0, 6).map((p, i) => (
                  <ProjectRow key={p.id} project={p} today={today} client={clients.find((c) => c.id === p.clientId)?.name} lead={byId(p.lead)?.name} index={i} />
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold tracking-tight">Recent activity</h2>
                <Link href="/notifications" className="text-xs font-medium text-brand">View all</Link>
              </div>
              <div className="space-y-1">
                {notes.slice(0, 6).map((n) => (
                  <Link
                    key={n.id}
                    href={n.href ?? "#"}
                    className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground">
                      {actIcon(n.type)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-tight">{n.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">{relativeTime(n.createdAt)}</p>
                    </div>
                  </Link>
                ))}
                {notes.length === 0 && <Empty label="No recent activity" />}
              </div>
            </Card>
          </div>

          {/* Breakdowns — analyst-consensus style bars */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <BarBreakdown
              title="Pipeline by stage"
              subtitle={formatCurrency(stats?.openPipeline ?? 0, { compact: true }) + " open"}
              rows={LEAD_STAGES.filter((s) => !["won", "lost"].includes(s.id)).map((s) => ({
                label: s.label, value: stats?.leadsByStatus[s.id] ?? 0,
              }))}
            />
            <BarBreakdown
              title="Projects by status"
              subtitle={`${stats?.counts.projects ?? 0} total`}
              rows={PROJECT_STAGES.map((s) => ({
                label: s.label, value: stats?.projectsByStatus[s.id] ?? 0,
              }))}
            />
            <Card className="p-5">
              <h2 className="mb-1 text-[15px] font-semibold tracking-tight">Client health</h2>
              <p className="mb-4 text-sm text-muted-foreground">{stats?.counts.activeClients ?? 0} active accounts</p>
              <div className="space-y-3">
                {([["green", "Healthy", "bg-success"], ["yellow", "At risk", "bg-warning"], ["red", "Critical", "bg-destructive"]] as const).map(([k, label, dot]) => (
                  <div key={k} className="flex items-center gap-3">
                    <span className={cn("size-2.5 rounded-full", dot)} />
                    <span className="text-sm">{label}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">{stats?.clientHealth[k] ?? 0}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" asChild className="mt-5 w-full">
                <Link href="/clients">Open clients</Link>
              </Button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function Stat({
  label, value, delta, hint, danger, index,
}: { label: string; value: string; delta?: number; hint: string; danger?: boolean; index: number }) {
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
          {delta !== undefined && (
            <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-medium", positive ? "text-muted-foreground" : "text-destructive")}>
              {positive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(delta)}%
            </span>
          )}
        </div>
        <p className={cn("mt-3 text-[26px] font-semibold leading-none tracking-tight tabular-nums", danger && Number(value) > 0 && "text-warning")}>
          {value}
        </p>
        <p className="mt-2 truncate text-[12px] text-muted-foreground/70">{hint}</p>
      </div>
    </motion.div>
  );
}

function RangePills({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            "relative rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
            value === r ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value === r && (
            <motion.span layoutId="range-pill" className="absolute inset-0 rounded-lg bg-background shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <span className="relative">{r}</span>
        </button>
      ))}
    </div>
  );
}

function FocusColumn({
  items, total, today, projectName,
}: { items: Task[]; total: number; today: number; projectName: (id: string) => string }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Today&apos;s focus</h2>
          <p className="text-sm text-muted-foreground">Assigned to you</p>
        </div>
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {total}
        </span>
      </div>
      <div className="-mx-2 flex-1 space-y-0.5">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <p className="mt-2 text-sm font-medium">All clear</p>
            <p className="text-xs text-muted-foreground">Nothing needs you right now.</p>
          </div>
        )}
        {items.map((t) => {
          const overdue = t.dueDate && new Date(t.dueDate).getTime() < today;
          return (
            <Link
              key={t.id}
              href="/tasks"
              className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-accent"
            >
              <span className="mt-0.5"><PriorityBadge priority={t.priority} showLabel={false} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium leading-tight">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">{projectName(t.projectId)}</p>
              </div>
              {t.dueDate && (
                <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium", overdue ? "text-destructive" : "text-muted-foreground")}>
                  {overdue ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
                  {relativeTime(t.dueDate)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <Button variant="outline" asChild className="mt-3 w-full">
        <Link href="/tasks">Open all tasks</Link>
      </Button>
    </Card>
  );
}

function ProjectRow({
  project, today, client, lead, index,
}: { project: Project; today: number; client?: string; lead?: string; index: number }) {
  const overdue = project.deadline && new Date(project.deadline).getTime() < today;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/projects/${project.id}`} className="flex items-center gap-4 rounded-xl px-2 py-2.5 transition-colors hover:bg-accent">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{project.name}</p>
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="size-2.5" /> Delayed
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{client ?? "—"} · {lead ?? "Unassigned"}</p>
        </div>
        <div className="hidden w-36 shrink-0 items-center gap-2 sm:flex">
          <Progress value={project.progress} className="h-1.5" indicatorClassName="bg-brand" />
          <span className="w-9 text-right text-xs font-medium tabular-nums text-muted-foreground">{project.progress}%</span>
        </div>
        <span className={cn("hidden w-20 shrink-0 text-right text-xs md:block", overdue ? "text-destructive" : "text-muted-foreground")}>
          {project.deadline ? formatDate(project.deadline, { month: "short", day: "numeric" }) : "—"}
        </span>
      </Link>
    </motion.div>
  );
}

function BarBreakdown({
  title, subtitle, rows,
}: { title: string; subtitle: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <p className="mb-4 text-[13px] text-muted-foreground">{subtitle}</p>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[13px] text-muted-foreground">{r.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(r.value / max) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full bg-brand"
              />
            </div>
            <span className="w-6 text-right text-[13px] font-medium tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{label}</p>;
}

function actIcon(type: AppNotification["type"]): React.ReactNode {
  const map: Record<string, React.ReactNode> = {
    invoice: <Receipt className="size-3.5" />,
    lead: <Target className="size-3.5" />,
    project: <Sparkles className="size-3.5" />,
    client: <AlertTriangle className="size-3.5" />,
    task: <CheckCircle2 className="size-3.5" />,
    system: <FileText className="size-3.5" />,
  };
  return map[type] ?? map.system;
}
