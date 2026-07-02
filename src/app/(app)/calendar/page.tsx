"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useResource } from "@/lib/use-resource";
import { useSession } from "@/components/providers/session-provider";
import { useTeam } from "@/components/providers/team-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { TaskStatusBadge, ProjectStatusBadge, LeadStatusBadge, InvoiceStatusBadge } from "@/components/shared/badges";
import { Badge } from "@/components/ui/badge";
import {
  TASK_STATUSES, PRIORITIES, DEADLINE_COLOR, FOLLOWUP_COLOR,
  CONTENT_TYPES, CONTENT_SCOPES, CONTENT_STATUSES,
  type Project, type Task, type Lead, type ContentPlan, type Invoice, type TeamMember,
  type Priority, type TaskStatus, type ContentScope, type ContentStatus,
} from "@/lib/types";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, CalendarDays, CalendarRange as CalRangeIcon, Calendar as CalendarIcon,
  FolderKanban, CheckSquare, CalendarClock, PhoneCall,
  FileText, Megaphone, Video, Mail, CalendarRange, Receipt, Plus, Loader2, SlidersHorizontal, RotateCcw,
  type LucideIcon,
} from "lucide-react";

type EventType = "deadline" | "task" | "followup" | "content" | "invoice";

/** Mild teal for invoice due dates — distinct from the other event colours. */
const INVOICE_COLOR = "hsl(180 35% 55%)";

interface CalEvent {
  id: string;
  date: Date;
  dayKey: string;
  label: string;
  type: EventType;
  href: string;
  project?: Project;
  task?: Task;
  lead?: Lead;
  content?: ContentPlan;
  invoice?: Invoice;
  start?: string; // "HH:MM" — present → renders as a time block
  end?: string;   // "HH:MM"
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Time-grid geometry */
const ROW_H = 48;                 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function hourLabel(h: number) {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}
/** Parse "HH:MM" → minutes from midnight, or null. */
function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const min = +m[1] * 60 + +m[2];
  return min >= 0 && min < 1440 ? min : null;
}
function fmtTime(min: number) {
  const h = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${mm} ${ampm}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Event-type filter definitions (invoice layer is finance-gated). */
const FILTER_DEFS: { key: EventType; label: string; finance?: boolean }[] = [
  { key: "deadline", label: "Projects" },
  { key: "task", label: "Tasks" },
  { key: "content", label: "Content" },
  { key: "followup", label: "Follow-ups" },
  { key: "invoice", label: "Invoices", finance: true },
];

/** Icons for content types, mirroring the content planner. */
const CONTENT_TYPE_ICON: Record<string, LucideIcon> = {
  blog: FileText, social: Megaphone, video: Video, newsletter: Mail, campaign: Megaphone, other: FileText,
};
function contentTypeColor(id: string) {
  return CONTENT_TYPES.find((t) => t.id === id)?.color ?? "hsl(220 9% 62%)";
}

/** Mild colour for a calendar event: deadlines red, follow-ups violet, content by type, tasks by stage. */
function eventColor(e: CalEvent) {
  if (e.type === "deadline") return DEADLINE_COLOR;
  if (e.type === "followup") return FOLLOWUP_COLOR;
  if (e.type === "content") return contentTypeColor(e.content?.type ?? "other");
  if (e.type === "invoice") return INVOICE_COLOR;
  return TASK_STATUSES.find((s) => s.id === e.task?.status)?.color ?? "hsl(220 9% 62%)";
}

/** Icon for an event, used in month chips and agenda rows. */
function eventIcon(e: CalEvent): LucideIcon {
  if (e.type === "deadline") return FolderKanban;
  if (e.type === "followup") return PhoneCall;
  if (e.type === "content") return CONTENT_TYPE_ICON[e.content?.type ?? "other"] ?? CalendarRange;
  if (e.type === "invoice") return Receipt;
  return CheckSquare;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function sameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function CalendarPage() {
  const { caps } = useSession();
  const team = useTeam();
  const projects = useResource<Project>("/api/r/projects");
  const tasks = useResource<Task>("/api/r/tasks");
  const leads = useResource<Lead>("/api/r/leads");
  const content = useResource<ContentPlan>("/api/r/content");

  // Invoices are finance-gated — only fetched for users who can view finance.
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  React.useEffect(() => {
    if (!caps.viewFinance) return;
    fetch("/api/r/invoices")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setInvoices(j.data ?? []))
      .catch(() => {});
  }, [caps.viewFinance]);

  const [viewDate, setViewDate] = React.useState<Date | null>(null);
  const [selected, setSelected] = React.useState<Date | null>(null);

  // Event-type filters (invoice only offered to finance-capable users).
  const [active, setActive] = React.useState<Record<EventType, boolean>>({
    deadline: true, task: true, content: true, followup: true, invoice: true,
  });
  const visibleFilters = FILTER_DEFS.filter((f) => !f.finance || caps.viewFinance);

  // Quick-plan dialog state.
  const [planOpen, setPlanOpen] = React.useState(false);
  const [planDate, setPlanDate] = React.useState<string>("");
  const [planTime, setPlanTime] = React.useState<string>("");
  const [planEnd, setPlanEnd] = React.useState<string>("");
  function openPlan(d?: Date, start?: string, end?: string) {
    setPlanDate(d ? toISODate(d) : "");
    setPlanTime(start ?? "");
    setPlanEnd(end ?? "");
    setPlanOpen(true);
  }

  React.useEffect(() => {
    const now = new Date();
    setViewDate(startOfMonth(now));
    setSelected(now);
  }, []);

  const loading = projects.loading || tasks.loading || leads.loading || content.loading;

  const events = React.useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = [];
    for (const p of projects.data) {
      if (!p.deadline) continue;
      const date = new Date(p.deadline);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        id: `p-${p.id}`,
        date,
        dayKey: dayKey(date),
        label: p.name,
        type: "deadline",
        href: `/projects/${p.id}`,
        project: p,
      });
    }
    for (const t of tasks.data) {
      if (!t.dueDate) continue;
      const date = new Date(t.dueDate);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        id: `t-${t.id}`,
        date,
        dayKey: dayKey(date),
        label: t.title,
        type: "task",
        href: "/tasks",
        task: t,
        start: t.startTime || undefined,
        end: t.endTime || undefined,
      });
    }
    for (const l of leads.data) {
      if (!l.followUpDate) continue;
      const date = new Date(l.followUpDate);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        id: `l-${l.id}`,
        date,
        dayKey: dayKey(date),
        label: l.company || l.name,
        type: "followup",
        href: "/leads",
        lead: l,
      });
    }
    for (const c of content.data) {
      if (!c.date) continue;
      const date = new Date(c.date);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        id: `c-${c.id}`,
        date,
        dayKey: dayKey(date),
        label: c.title,
        type: "content",
        href: "/content",
        content: c,
        start: c.startTime || undefined,
        end: c.endTime || undefined,
      });
    }
    // Invoice due dates — unpaid only (sent / overdue), finance users only.
    for (const inv of invoices) {
      if (!inv.dueDate || inv.status === "paid" || inv.status === "draft") continue;
      const date = new Date(inv.dueDate);
      if (Number.isNaN(date.getTime())) continue;
      out.push({
        id: `i-${inv.id}`,
        date,
        dayKey: dayKey(date),
        label: `Invoice ${inv.number}`,
        type: "invoice",
        href: "/invoices",
        invoice: inv,
      });
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [projects.data, tasks.data, leads.data, content.data, invoices]);

  // Apply the active event-type filters.
  const filteredEvents = React.useMemo(
    () => events.filter((e) => active[e.type]),
    [events, active]
  );

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of filteredEvents) {
      const arr = map.get(e.dayKey);
      if (arr) arr.push(e);
      else map.set(e.dayKey, [e]);
    }
    return map;
  }, [filteredEvents]);

  // Per-type counts for the filter UI (from all loaded events).
  const counts = React.useMemo(() => {
    const c: Record<EventType, number> = { deadline: 0, task: 0, content: 0, followup: 0, invoice: 0 };
    for (const e of events) c[e.type]++;
    return c;
  }, [events]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Project deadlines, tasks, follow-ups, content plans and invoice due dates — all in one place."
      >
        <Button onClick={() => openPlan(selected ?? new Date())} className="gap-2">
          <Plus className="size-4" /> Plan
        </Button>
      </PageHeader>

      {/* Event-type filters */}
      <FilterControl defs={visibleFilters} active={active} counts={counts} setActive={setActive} />

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">
            <CalendarDays className="size-4" /> Month
          </TabsTrigger>
          <TabsTrigger value="week">
            <CalRangeIcon className="size-4" /> Week
          </TabsTrigger>
          <TabsTrigger value="day">
            <CalendarIcon className="size-4" /> Day
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <CalendarClock className="size-4" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="month">
          {loading || !viewDate ? (
            <Skeleton className="h-[560px] w-full rounded-2xl" />
          ) : (
            <MonthView
              viewDate={viewDate}
              setViewDate={setViewDate}
              selected={selected}
              setSelected={setSelected}
              eventsByDay={eventsByDay}
              onPlan={openPlan}
            />
          )}
        </TabsContent>

        <TabsContent value="week">
          {loading || !viewDate ? (
            <Skeleton className="h-[560px] w-full rounded-2xl" />
          ) : (
            <WeekView
              viewDate={viewDate}
              setViewDate={setViewDate}
              selected={selected}
              setSelected={setSelected}
              eventsByDay={eventsByDay}
              onPlan={openPlan}
            />
          )}
        </TabsContent>

        <TabsContent value="day">
          {loading || !viewDate ? (
            <Skeleton className="h-[480px] w-full rounded-2xl" />
          ) : (
            <DayView
              viewDate={viewDate}
              setViewDate={setViewDate}
              selected={selected}
              setSelected={setSelected}
              eventsByDay={eventsByDay}
              onPlan={openPlan}
            />
          )}
        </TabsContent>

        <TabsContent value="agenda">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : (
            <AgendaView events={filteredEvents} />
          )}
        </TabsContent>
      </Tabs>

      <PlanDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        date={planDate}
        time={planTime}
        end={planEnd}
        canContent={caps.manageContent}
        members={team.members}
        projects={projects.data}
        createTask={tasks.create}
        createContent={content.create}
      />
    </div>
  );
}

/** Dot colour for a filter chip. */
function filterColor(key: EventType) {
  if (key === "deadline") return DEADLINE_COLOR;
  if (key === "followup") return FOLLOWUP_COLOR;
  if (key === "invoice") return INVOICE_COLOR;
  if (key === "content") return CONTENT_TYPES[0].color;
  return TASK_STATUSES[1].color;
}

/** Icon for a filter type. */
function filterIcon(key: EventType): LucideIcon {
  if (key === "deadline") return FolderKanban;
  if (key === "followup") return PhoneCall;
  if (key === "invoice") return Receipt;
  if (key === "content") return CalendarRange;
  return CheckSquare;
}

/* ---------------- Filter control (popover + active pills) ---------------- */

function FilterControl({
  defs, active, counts, setActive,
}: {
  defs: { key: EventType; label: string }[];
  active: Record<EventType, boolean>;
  counts: Record<EventType, number>;
  setActive: React.Dispatch<React.SetStateAction<Record<EventType, boolean>>>;
}) {
  const activeCount = defs.filter((d) => active[d.key]).length;
  const allOn = activeCount === defs.length;

  function toggle(key: EventType) {
    setActive((a) => ({ ...a, [key]: !a[key] }));
  }
  function setAll(on: boolean) {
    setActive((a) => {
      const next = { ...a };
      for (const d of defs) next[d.key] = on;
      return next;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <SlidersHorizontal className="size-4" />
            Filters
            <span className="rounded-md bg-secondary px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
              {activeCount}/{defs.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Show on calendar</p>
            <button
              onClick={() => setAll(!allOn)}
              className="text-[11px] font-medium text-brand hover:underline"
            >
              {allOn ? "Clear all" : "Select all"}
            </button>
          </div>
          <div className="space-y-0.5">
            {defs.map((d) => {
              const Icon = filterIcon(d.key);
              const color = filterColor(d.key);
              const on = active[d.key];
              return (
                <button
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Checkbox checked={on} className="pointer-events-none" />
                  <span className="flex size-6 items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="flex-1">{d.label}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{counts[d.key] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active type pills — click to hide that layer. */}
      {defs.filter((d) => active[d.key]).map((d) => {
        const color = filterColor(d.key);
        return (
          <button
            key={d.key}
            onClick={() => toggle(d.key)}
            title={`Hide ${d.label}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 py-1 pl-2.5 pr-2 text-[12px] font-medium transition-colors hover:bg-secondary"
          >
            <span className="size-2 rounded-full" style={{ background: color }} />
            {d.label}
            <span className="tabular-nums text-muted-foreground">{counts[d.key] ?? 0}</span>
          </button>
        );
      })}
      {activeCount < defs.length && (
        <button
          onClick={() => setAll(true)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-3" /> Reset
        </button>
      )}
    </div>
  );
}

function MonthView({
  viewDate,
  setViewDate,
  selected,
  setSelected,
  eventsByDay,
  onPlan,
}: {
  viewDate: Date;
  setViewDate: (d: Date) => void;
  selected: Date | null;
  setSelected: (d: Date) => void;
  eventsByDay: Map<string, CalEvent[]>;
  onPlan: (d: Date) => void;
}) {
  const today = React.useMemo(() => new Date(), []);

  const cells = React.useMemo(() => {
    const first = startOfMonth(viewDate);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewDate]);

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(viewDate);

  const selectedEvents = selected ? eventsByDay.get(dayKey(selected)) ?? [] : [];

  function shiftMonth(delta: number) {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));
  }
  function goToday() {
    const now = new Date();
    setViewDate(startOfMonth(now));
    setSelected(now);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel bodyClassName="p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-lg font-semibold tabular-nums">{monthLabel}</h2>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-border">
          {DOW.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === viewDate.getMonth();
            const isToday = sameDay(d, today);
            const isSelected = selected ? sameDay(d, selected) : false;
            const dayEvents = eventsByDay.get(dayKey(d)) ?? [];
            const shown = dayEvents.slice(0, 3);
            const extra = dayEvents.length - shown.length;
            return (
              <div
                key={i}
                onClick={() => setSelected(d)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setSelected(d); } }}
                className={cn(
                  "group/cell relative flex min-h-[92px] cursor-pointer flex-col gap-1 border-b border-r border-border p-1.5 text-left transition-colors hover:bg-accent/50",
                  i % 7 === 0 && "border-l",
                  !inMonth && "bg-muted/30 text-muted-foreground/50",
                  isSelected && "ring-1 ring-inset ring-brand/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      isToday && "bg-brand font-semibold text-brand-foreground",
                      !isToday && !inMonth && "text-muted-foreground/50"
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {/* Hover quick-add — plan an item on this day. */}
                  <button
                    onClick={(ev) => { ev.stopPropagation(); onPlan(d); }}
                    aria-label={`Plan something on ${formatDate(d)}`}
                    className="flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-brand hover:text-brand-foreground focus:opacity-100 group-hover/cell:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-0.5">
                  {shown.map((e) => {
                    const color = eventColor(e);
                    const Icon = eventIcon(e);
                    return (
                      <span
                        key={e.id}
                        title={e.label}
                        style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
                        className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium leading-tight"
                      >
                        <Icon className="size-2.5 shrink-0" />
                        <span className="truncate">{e.label}</span>
                      </span>
                    );
                  })}
                  {extra > 0 && (
                    <span className="px-1 text-[10px] font-medium text-muted-foreground">
                      +{extra} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title={selected ? formatDate(selected, { weekday: "long" }) : "Select a day"}
        description={selected ? formatDate(selected) : undefined}
        action={selected ? (
          <Button size="icon-sm" variant="outline" aria-label="Plan on this day" onClick={() => onPlan(selected)}>
            <Plus className="size-4" />
          </Button>
        ) : undefined}
      >
        {selectedEvents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No events on this day.
          </p>
        ) : (
          <ul className="space-y-2">
            {selectedEvents.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

interface ViewProps {
  viewDate: Date;
  setViewDate: (d: Date) => void;
  selected: Date | null;
  setSelected: (d: Date) => void;
  eventsByDay: Map<string, CalEvent[]>;
  onPlan: (d: Date, start?: string, end?: string) => void;
}

const SNAP = 15; // minutes
function snapMin(min: number) {
  return Math.max(0, Math.min(1440, Math.round(min / SNAP) * SNAP));
}
function minToStr(min: number) {
  const m = Math.min(1439, Math.max(0, min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/* A single timed event block positioned within a day column. */
function TimedBlock({ ev }: { ev: CalEvent }) {
  const start = toMinutes(ev.start) ?? 0;
  const end = Math.max(start + 30, toMinutes(ev.end) ?? start + 60);
  const color = eventColor(ev);
  const Icon = eventIcon(ev);
  const top = (start / 60) * ROW_H;
  const height = Math.max(20, ((end - start) / 60) * ROW_H - 2);
  return (
    <Link
      href={ev.href}
      onClick={(e) => e.stopPropagation()}
      title={`${ev.label} · ${fmtTime(start)}`}
      style={{
        top, height,
        backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        borderLeft: `2px solid ${color}`,
        color,
      }}
      className="absolute left-0.5 right-1 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-opacity hover:opacity-85"
    >
      <span className="flex items-center gap-1">
        <Icon className="size-3 shrink-0" />
        <span className="truncate">{ev.label}</span>
      </span>
      {height > 30 && <span className="block text-[10px] opacity-75">{fmtTime(start)}</span>}
    </Link>
  );
}

/* Shared time grid (1 day or 7). All-day row on top, hour grid below. */
function TimeGrid({ days, eventsByDay, selected, setSelected, onPlan }: {
  days: Date[];
  eventsByDay: Map<string, CalEvent[]>;
  selected: Date | null;
  setSelected: (d: Date) => void;
  onPlan: (d: Date, time?: string) => void;
}) {
  const today = React.useMemo(() => new Date(), []);
  const [nowMin, setNowMin] = React.useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); });
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const id = setInterval(() => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); }, 60_000);
    return () => clearInterval(id);
  }, []);
  React.useEffect(() => {
    // Open near the work day like Google/Notion.
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * ROW_H;
  }, []);

  const cols = `repeat(${days.length}, minmax(0, 1fr))`;
  const gridH = 24 * ROW_H;

  // Drag-to-block (Notion style): press, drag start→end, release to plan.
  const dragRef = React.useRef<{ dayIdx: number; anchor: number; moved: boolean } | null>(null);
  const [drag, setDrag] = React.useState<{ dayIdx: number; s: number; e: number } | null>(null);

  function yToMin(clientY: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return snapMin(((clientY - rect.top) / ROW_H) * 60);
  }

  function onColPointerDown(ev: React.PointerEvent<HTMLDivElement>, dayIdx: number) {
    // Ignore clicks that land on an existing event block.
    if ((ev.target as HTMLElement).closest("a")) return;
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    const el = ev.currentTarget;
    el.setPointerCapture(ev.pointerId);
    const at = yToMin(ev.clientY, el);
    dragRef.current = { dayIdx, anchor: at, moved: false };
    setDrag({ dayIdx, s: at, e: at + SNAP });
  }
  function onColPointerMove(ev: React.PointerEvent<HTMLDivElement>) {
    const cur = dragRef.current;
    if (!cur) return;
    const at = yToMin(ev.clientY, ev.currentTarget);
    if (at !== cur.anchor) cur.moved = true;
    setDrag({ dayIdx: cur.dayIdx, s: Math.min(cur.anchor, at), e: Math.max(cur.anchor, at) });
  }
  function onColPointerUp(ev: React.PointerEvent<HTMLDivElement>, d: Date) {
    const cur = dragRef.current;
    dragRef.current = null;
    if (!cur) return;
    const at = yToMin(ev.clientY, ev.currentTarget);
    const s = Math.min(cur.anchor, at);
    let e = Math.max(cur.anchor, at);
    if (e - s < SNAP) e = Math.min(1440, s + 60); // a tap → default 1-hour block
    setDrag(null);
    onPlan(d, minToStr(s), minToStr(e));
  }

  return (
    <Panel bodyClassName="p-0">
      {/* Day headers */}
      <div className="flex border-b border-border">
        <div className="w-16 shrink-0" />
        <div className="grid flex-1" style={{ gridTemplateColumns: cols }}>
          {days.map((d, i) => {
            const isToday = sameDay(d, today);
            const isSelected = selected ? sameDay(d, selected) : false;
            return (
              <div
                key={i}
                onClick={() => setSelected(d)}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setSelected(d); } }}
                className={cn(
                  "group/h flex cursor-pointer items-center justify-between gap-1 border-l border-border px-2 py-2 transition-colors hover:bg-accent/40",
                  isSelected && "bg-accent/30"
                )}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{DOW[d.getDay()]}</span>
                  <span className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    isToday && "bg-brand font-semibold text-brand-foreground"
                  )}>{d.getDate()}</span>
                </div>
                <button
                  onClick={(ev) => { ev.stopPropagation(); onPlan(d); }}
                  aria-label={`Plan on ${formatDate(d)}`}
                  className="flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-brand hover:text-brand-foreground focus:opacity-100 group-hover/h:opacity-100"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-day row */}
      <div className="flex border-b border-border bg-muted/20">
        <div className="flex w-16 shrink-0 items-start justify-end px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">All-day</div>
        <div className="grid flex-1" style={{ gridTemplateColumns: cols }}>
          {days.map((d, i) => {
            const allDay = (eventsByDay.get(dayKey(d)) ?? []).filter((e) => toMinutes(e.start) === null);
            return (
              <div
                key={i}
                onClick={() => onPlan(d)}
                className="min-h-[34px] cursor-pointer space-y-0.5 border-l border-border p-1"
              >
                {allDay.map((e) => {
                  const color = eventColor(e);
                  const Icon = eventIcon(e);
                  return (
                    <Link
                      key={e.id}
                      href={e.href}
                      onClick={(ev) => ev.stopPropagation()}
                      title={e.label}
                      style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium leading-tight"
                    >
                      <Icon className="size-2.5 shrink-0" />
                      <span className="truncate">{e.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable hour grid */}
      <div ref={scrollRef} className="max-h-[64vh] overflow-y-auto">
        <div className="flex" style={{ height: gridH }}>
          {/* Hour gutter */}
          <div className="relative w-16 shrink-0">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground/70" style={{ top: h * ROW_H }}>
                {h === 0 ? "" : hourLabel(h)}
              </div>
            ))}
          </div>
          {/* Day columns */}
          <div className="grid flex-1" style={{ gridTemplateColumns: cols }}>
            {days.map((d, i) => {
              const timed = (eventsByDay.get(dayKey(d)) ?? [])
                .filter((e) => toMinutes(e.start) !== null)
                .sort((a, b) => (toMinutes(a.start)! - toMinutes(b.start)!));
              const isToday = sameDay(d, today);
              const isDragging = drag?.dayIdx === i && drag.e > drag.s;
              return (
                <div
                  key={i}
                  onPointerDown={(e) => onColPointerDown(e, i)}
                  onPointerMove={onColPointerMove}
                  onPointerUp={(e) => onColPointerUp(e, d)}
                  className="relative cursor-pointer touch-none select-none border-l border-border"
                  style={{ height: gridH }}
                >
                  {HOURS.map((h) => (
                    <div key={h} className="border-t border-border/50" style={{ height: ROW_H }} />
                  ))}
                  {timed.map((e) => <TimedBlock key={e.id} ev={e} />)}
                  {/* Live drag preview */}
                  {isDragging && (
                    <div
                      className="pointer-events-none absolute left-0.5 right-1 z-30 rounded-md border border-brand/60 bg-brand/20 px-1.5 py-0.5 text-[10px] font-medium text-brand"
                      style={{ top: (drag!.s / 60) * ROW_H, height: Math.max(14, ((drag!.e - drag!.s) / 60) * ROW_H - 2) }}
                    >
                      {fmtTime(drag!.s)} – {fmtTime(drag!.e)}
                    </div>
                  )}
                  {isToday && (
                    <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: (nowMin / 60) * ROW_H }}>
                      <span className="size-2 shrink-0 rounded-full bg-destructive" />
                      <span className="h-px flex-1 bg-destructive" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function WeekView({ viewDate, setViewDate, selected, setSelected, eventsByDay, onPlan }: ViewProps) {
  const weekStart = startOfWeek(viewDate);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = days[6];
  const rangeLabel =
    `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ` +
    `${weekEnd.toLocaleDateString("en-US", { month: weekStart.getMonth() === weekEnd.getMonth() ? undefined : "short", day: "numeric" })}`;

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + delta * 7);
    setViewDate(d);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tabular-nums">{rangeLabel}</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => { setViewDate(new Date()); setSelected(new Date()); }}>This week</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftWeek(1)} aria-label="Next week"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <TimeGrid days={days} eventsByDay={eventsByDay} selected={selected} setSelected={setSelected} onPlan={onPlan} />
    </div>
  );
}

function DayView({ viewDate, setViewDate, selected, setSelected, eventsByDay, onPlan }: ViewProps) {
  const today = React.useMemo(() => new Date(), []);
  const day = selected ?? viewDate;
  const isToday = sameDay(day, today);

  function shiftDay(delta: number) {
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate() + delta);
    setSelected(d);
    setViewDate(d);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{formatDate(day, { weekday: "long" })}</h2>
          <span className="text-sm text-muted-foreground tabular-nums">{formatDate(day)}</span>
          {isToday && <Badge variant="secondary">Today</Badge>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => { const n = new Date(); setSelected(n); setViewDate(n); }}>Today</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftDay(-1)} aria-label="Previous day"><ChevronLeft className="size-4" /></Button>
          <Button variant="ghost" size="icon-sm" onClick={() => shiftDay(1)} aria-label="Next day"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <TimeGrid days={[day]} eventsByDay={eventsByDay} selected={selected} setSelected={setSelected} onPlan={onPlan} />
    </div>
  );
}

function AgendaView({ events }: { events: CalEvent[] }) {
  const upcoming = React.useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return events.filter((e) => e.date.getTime() >= start.getTime());
  }, [events]);

  const groups = React.useMemo(() => {
    const map = new Map<string, { date: Date; items: CalEvent[] }>();
    for (const e of upcoming) {
      const g = map.get(e.dayKey);
      if (g) g.items.push(e);
      else map.set(e.dayKey, { date: e.date, items: [e] });
    }
    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [upcoming]);

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing upcoming"
        description="No project deadlines or task due dates ahead."
      />
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <motion.div
          key={dayKey(g.date)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: gi * 0.03 }}
        >
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">
              {formatDate(g.date, { weekday: "long" })}
            </h3>
            <span className="text-xs text-muted-foreground">{formatDate(g.date)}</span>
          </div>
          <ul className="space-y-2">
            {g.items.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </ul>
        </motion.div>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: CalEvent }) {
  const Icon = eventIcon(event);
  const color = eventColor(event);
  const kind =
    event.type === "deadline" ? "Project deadline"
    : event.type === "followup" ? "Lead follow-up"
    : event.type === "content" ? "Content plan"
    : event.type === "invoice" ? "Invoice due"
    : "Task due";
  return (
    <li>
      <Link
        href={event.href}
        className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-[hsl(0_0%_23%)]"
      >
        <span
          style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{event.label}</p>
          <p className="text-xs text-muted-foreground">
            {toMinutes(event.start) !== null ? `${fmtTime(toMinutes(event.start)!)} · ` : ""}{kind}
          </p>
        </div>
        <div className="shrink-0">
          {event.project && <ProjectStatusBadge status={event.project.status} />}
          {event.task && <TaskStatusBadge status={event.task.status} />}
          {event.lead && <LeadStatusBadge status={event.lead.status} />}
          {event.content && (
            <Badge variant="secondary" className="gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: color }} />
              {CONTENT_SCOPES.find((s) => s.id === event.content!.scope)?.label}
            </Badge>
          )}
          {event.invoice && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatCurrency(event.invoice.amount, { compact: true })}
              </span>
              <InvoiceStatusBadge status={event.invoice.status} />
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

/* ---------------- Quick-plan dialog (task or content) ---------------- */

type PlanMode = "task" | "content";

function PlanDialog({
  open, onOpenChange, date, time, end, canContent, members, projects, createTask, createContent,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: string;
  time: string;
  end: string;
  canContent: boolean;
  members: TeamMember[];
  projects: Project[];
  createTask: (payload: Partial<Task> & Record<string, unknown>) => Promise<Task | null>;
  createContent: (payload: Partial<ContentPlan> & Record<string, unknown>) => Promise<ContentPlan | null>;
}) {
  const [mode, setMode] = React.useState<PlanMode>("task");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [when, setWhen] = React.useState(date);
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [assignee, setAssignee] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  // task-only
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [taskStatus, setTaskStatus] = React.useState<TaskStatus>("todo");
  // content-only
  const [type, setType] = React.useState("blog");
  const [scope, setScope] = React.useState<ContentScope>("weekly");
  const [contentStatus, setContentStatus] = React.useState<ContentStatus>("planned");
  const [saving, setSaving] = React.useState(false);

  // One hour after the given start time, for a sensible default end.
  const plusHour = (t: string) => {
    const m = toMinutes(t);
    if (m === null) return "";
    const e = Math.min(1439, m + 60);
    return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
  };

  // Reset the form whenever the dialog opens (sync the clicked date/time/range).
  React.useEffect(() => {
    if (!open) return;
    setMode("task");
    setTitle(""); setDescription(""); setWhen(date); setAssignee(""); setProjectId("");
    setStartTime(time); setEndTime(end || (time ? plusHour(time) : ""));
    setPriority("medium"); setTaskStatus("todo");
    setType("blog"); setScope("weekly"); setContentStatus("planned");
  }, [open, date, time, end]);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    let res: Task | ContentPlan | null;
    if (mode === "task") {
      res = await createTask({
        title, description, priority, status: taskStatus,
        assignee, projectId, dueDate: when, startTime, endTime,
      });
    } else {
      res = await createContent({
        title, description, type, scope, status: contentStatus,
        assignee, date: when, projectId, startTime, endTime,
      });
    }
    setSaving(false);
    if (res) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] max-w-xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Plan {mode === "task" ? "a task" : "content"}</DialogTitle>
          <DialogDescription>Add it straight to the calendar. Only a title is required.</DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        {canContent && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-0.5">
            {(["task", "content"] as PlanMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <PlanField label="Title" className="col-span-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "task" ? "Review homepage copy" : "Launch teaser post"} autoFocus />
          </PlanField>

          <PlanField label="Date" className="col-span-2">
            <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
          </PlanField>

          <div className="col-span-2">
            <TimeRow
              startTime={startTime}
              endTime={endTime}
              setStartTime={setStartTime}
              setEndTime={setEndTime}
              plusHour={plusHour}
            />
          </div>

          {mode === "task" ? (
            <>
              <PlanField label="Priority">
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </PlanField>
              <PlanField label="Status">
                <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as TaskStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </PlanField>
            </>
          ) : (
            <>
              <PlanField label="Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </PlanField>
              <PlanField label="Scope (cadence)">
                <Select value={scope} onValueChange={(v) => setScope(v as ContentScope)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_SCOPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </PlanField>
              <PlanField label="Status">
                <Select value={contentStatus} onValueChange={(v) => setContentStatus(v as ContentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTENT_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </PlanField>
            </>
          )}

          <PlanField label="Assignee">
            <Select value={assignee || "none"} onValueChange={(v) => setAssignee(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </PlanField>
          <PlanField label="Related project">
            <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </PlanField>
          <PlanField label="Notes" className="col-span-2">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
          </PlanField>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()} className="gap-2">
            {saving && <Loader2 className="size-4 animate-spin" />} Add to calendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlanField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Simple, optional time picker: an "Add time" switch reveals a start → end range. */
function TimeRow({
  startTime, endTime, setStartTime, setEndTime, plusHour,
}: {
  startTime: string;
  endTime: string;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
  plusHour: (t: string) => string;
}) {
  const timed = !!startTime;
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          Time {!timed && <span className="font-normal text-muted-foreground">· all-day</span>}
        </Label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          Add time
          <Switch
            checked={timed}
            onCheckedChange={(v) => {
              if (v) { setStartTime("09:00"); setEndTime("10:00"); }
              else { setStartTime(""); setEndTime(""); }
            }}
          />
        </label>
      </div>
      {timed && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="time"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              if (e.target.value && (!endTime || endTime <= e.target.value)) setEndTime(plusHour(e.target.value));
            }}
            className="h-9"
          />
          <span className="text-muted-foreground">→</span>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-9" />
        </div>
      )}
    </div>
  );
}
