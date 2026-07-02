"use client";

import * as React from "react";
import Link from "next/link";
import { useResource } from "@/lib/use-resource";
import { useTeam } from "@/components/providers/team-provider";
import { useSession } from "@/components/providers/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/section";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  CONTENT_TYPES, CONTENT_SCOPES, CONTENT_STATUSES,
  type ContentPlan, type ContentScope, type ContentStatus, type Project,
} from "@/lib/types";
import {
  Plus, Loader2, ListChecks, LayoutGrid, CalendarDays, CalendarClock,
  FileText, Megaphone, Video, Mail, CalendarRange, type LucideIcon,
} from "lucide-react";

/* ---- visual maps: type → color/icon, scope → icon ---- */
const TYPE_ICON: Record<string, LucideIcon> = {
  blog: FileText, social: Megaphone, video: Video, newsletter: Mail, campaign: Megaphone, other: FileText,
};
const SCOPE_ICON: Record<ContentScope, LucideIcon> = {
  monthly: CalendarRange, weekly: CalendarDays, daily: CalendarClock,
};

function typeOf(id: string) {
  return CONTENT_TYPES.find((t) => t.id === id) ?? CONTENT_TYPES[CONTENT_TYPES.length - 1];
}
const typeColor = (id: string) => typeOf(id).color;
const typeIcon = (id: string) => TYPE_ICON[id] ?? FileText;

type FormState = {
  title: string; description: string; type: string; scope: ContentScope;
  status: ContentStatus; date: string; startTime: string; endTime: string;
  assignee: string; projectId: string;
};
const EMPTY: FormState = {
  title: "", description: "", type: "blog", scope: "weekly",
  status: "planned", date: "", startTime: "", endTime: "", assignee: "", projectId: "",
};

const plusHour = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return "";
  const e = Math.min(1439, +m[1] * 60 + +m[2] + 60);
  return `${String(Math.floor(e / 60)).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
};

export default function ContentPage() {
  const { caps } = useSession();
  const team = useTeam();
  const projects = useResource<Project>("/api/r/projects");
  const { data, loading, create, update, remove } = useResource<ContentPlan>("/api/r/content");

  const [scopeFilter, setScopeFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ContentPlan | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(
    () =>
      data.filter(
        (c) =>
          (scopeFilter === "all" || c.scope === scopeFilter) &&
          (typeFilter === "all" || c.type === typeFilter) &&
          (assigneeFilter === "all" || c.assignee === assigneeFilter)
      ),
    [data, scopeFilter, typeFilter, assigneeFilter]
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setDialogOpen(true);
  }
  function openEdit(c: ContentPlan) {
    setEditing(c);
    setForm({
      title: c.title, description: c.description ?? "", type: c.type, scope: c.scope,
      status: c.status, date: c.date ?? "", startTime: c.startTime ?? "", endTime: c.endTime ?? "",
      assignee: c.assignee ?? "", projectId: c.projectId ?? "",
    });
    setDialogOpen(true);
  }
  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = editing ? await update(editing.id, form) : await create(form);
    setSaving(false);
    if (res) setDialogOpen(false);
  }
  async function del() {
    if (!editing) return;
    const ok = await remove(editing.id);
    if (ok) setDialogOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Planning"
        description="Plan monthly, weekly and daily content. It all shows on the shared Calendar too."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/calendar"><CalendarDays className="size-4" /> Open calendar</Link>
          </Button>
          {caps.manageContent && (
            <Button onClick={openAdd} className="gap-2">
              <Plus className="size-4" /> Plan content
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={scopeFilter} onValueChange={setScopeFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scopes</SelectItem>
            {CONTENT_SCOPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {team.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto hidden flex-wrap items-center gap-3 lg:flex">
          {CONTENT_TYPES.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list"><ListChecks className="size-4" /> List</TabsTrigger>
          <TabsTrigger value="board"><LayoutGrid className="size-4" /> Team board</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
          ) : (
            <ListView items={filtered} onOpen={openEdit} />
          )}
        </TabsContent>

        <TabsContent value="board">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
            </div>
          ) : (
            <BoardView items={filtered} onOpen={openEdit} />
          )}
        </TabsContent>
      </Tabs>

      {/* Add / Edit dialog — only closes via its buttons (no click-outside / Esc). */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[88vh] max-w-xl overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editing ? "Edit content" : "Plan content"}</DialogTitle>
            <DialogDescription>
              Only a title is required — fill in the rest whenever you like.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" className="col-span-2">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="June product launch teaser" autoFocus />
            </Field>
            <Field label="Type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Scope (cadence)">
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as ContentScope })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_SCOPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Date (optional)">
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ContentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTENT_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="col-span-2">
              <TimeRow
                startTime={form.startTime}
                endTime={form.endTime}
                setStartTime={(v) => setForm((f) => ({ ...f, startTime: v }))}
                setEndTime={(v) => setForm((f) => ({ ...f, endTime: v }))}
              />
            </div>
            <Field label="Assignee">
              <Select value={form.assignee || "none"} onValueChange={(v) => setForm({ ...form, assignee: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {team.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Related project">
              <Select value={form.projectId || "none"} onValueChange={(v) => setForm({ ...form, projectId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes / brief" className="col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief, references, channel, hooks…"
                className="min-h-[120px]"
              />
            </Field>
          </div>

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <Button variant="ghost" onClick={del} className="text-destructive hover:text-destructive">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.title.trim()} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContentRow({ item, onClick }: { item: ContentPlan; onClick: () => void }) {
  const color = typeColor(item.type);
  const Icon = typeIcon(item.type);
  const ScopeIcon = SCOPE_ICON[item.scope];
  const status = CONTENT_STATUSES.find((s) => s.id === item.status);
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-[hsl(0_0%_23%)]">
      <span style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
        className="flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ScopeIcon className="size-3" /> {CONTENT_SCOPES.find((s) => s.id === item.scope)?.label}
          {status && <><span>·</span><span style={{ color: status.color }}>{status.label}</span></>}
          {item.date && <><span>·</span><span>{item.date}</span></>}
        </p>
      </div>
    </button>
  );
}

/** Flat list grouped by month (unscheduled items last). */
function ListView({ items, onOpen }: { items: ContentPlan[]; onOpen: (c: ContentPlan) => void }) {
  const groups = React.useMemo(() => {
    const dated = items.filter((c) => c.date).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const undated = items.filter((c) => !c.date);
    const map = new Map<string, ContentPlan[]>();
    for (const c of dated) {
      const d = new Date(c.date);
      const key = Number.isNaN(d.getTime())
        ? "Other"
        : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    const out = Array.from(map.entries()).map(([label, list]) => ({ label, list }));
    if (undated.length) out.push({ label: "Unscheduled", list: undated });
    return out;
  }, [items]);

  if (items.length === 0) {
    return <EmptyState icon={ListChecks} title="No content planned" description="Plan content to build out your calendar." />;
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-sm font-semibold">{g.label}</h3>
            <span className="text-xs text-muted-foreground">{g.list.length}</span>
          </div>
          <ul className="space-y-2">
            {g.list.map((c) => <li key={c.id}><ContentRow item={c} onClick={() => onOpen(c)} /></li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BoardView({ items, onOpen }: { items: ContentPlan[]; onOpen: (c: ContentPlan) => void }) {
  const team = useTeam();

  const groups = React.useMemo(() => {
    const map = new Map<string, ContentPlan[]>();
    for (const c of items) {
      const key = c.assignee || "unassigned";
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    return map;
  }, [items]);

  if (items.length === 0) {
    return <EmptyState icon={LayoutGrid} title="No content planned" description="Plan content and it will appear here grouped by team member." />;
  }

  const memberPanels = team.members.filter((m) => groups.has(m.id));
  const unassigned = groups.get("unassigned") ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {memberPanels.map((m) => (
        <Panel key={m.id} bodyClassName="space-y-2">
          <div className="mb-1 flex items-center gap-2.5">
            <UserAvatar name={m.name} src={m.avatar} className="size-8" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-tight">{m.name}</p>
              <p className="truncate text-xs text-muted-foreground">{(groups.get(m.id) ?? []).length} planned</p>
            </div>
          </div>
          {(groups.get(m.id) ?? []).map((c) => <ContentRow key={c.id} item={c} onClick={() => onOpen(c)} />)}
        </Panel>
      ))}
      {unassigned.length > 0 && (
        <Panel bodyClassName="space-y-2">
          <p className="mb-1 text-sm font-medium text-muted-foreground">Unassigned · {unassigned.length}</p>
          {unassigned.map((c) => <ContentRow key={c.id} item={c} onClick={() => onOpen(c)} />)}
        </Panel>
      )}
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

/** Simple, optional time picker: an "Add time" switch reveals a start → end range. */
function TimeRow({
  startTime, endTime, setStartTime, setEndTime,
}: {
  startTime: string;
  endTime: string;
  setStartTime: (v: string) => void;
  setEndTime: (v: string) => void;
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
