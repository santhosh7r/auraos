"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  currentWeekKey, recentWeeks, weekLabel, weekTag, shiftWeek,
} from "@/lib/week";
import type {
  LeaderboardData, StandingEntry, WeekSummary, RewardStatus, Trend, RewardStackItem,
} from "@/lib/types";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import {
  Trophy, Gift, ArrowUp, ArrowDown, Minus,
  Loader2, Trash2, Check, CheckCircle2, Clock, CalendarDays, Package,
} from "lucide-react";

/* ------------------------------------------------------------------ */

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

const STATUS_META: Record<RewardStatus, { label: string; dot: string; text: string }> = {
  none:        { label: "No reward",   dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  pending:     { label: "Awaiting work", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  in_progress: { label: "In progress", dot: "bg-[hsl(213_50%_62%)]",   text: "text-[hsl(213_55%_66%)]" },
  earned:      { label: "Unlocked",    dot: "bg-[hsl(150_40%_50%)]",   text: "text-[hsl(150_42%_56%)]" },
  missed:      { label: "Missed",      dot: "bg-destructive",          text: "text-destructive" },
};

function StatusPill({ status }: { status: RewardStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

function TrendMark({ trend, delta }: { trend: Trend; delta: number }) {
  if (trend === "new") return <span className="text-[11px] text-muted-foreground/70">new</span>;
  if (trend === "up") return <span className="inline-flex items-center gap-0.5 text-[11px] text-[hsl(150_42%_56%)]"><ArrowUp className="size-3" />{delta}</span>;
  if (trend === "down") return <span className="inline-flex items-center gap-0.5 text-[11px] text-destructive"><ArrowDown className="size-3" />{Math.abs(delta)}</span>;
  return <span className="text-[11px] text-muted-foreground/50">—</span>;
}

/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const { user, role } = useSession();
  const admin = role === "admin";

  const [week, setWeek] = React.useState<string>(() => currentWeekKey());
  const [data, setData] = React.useState<LeaderboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [rewardOpen, setRewardOpen] = React.useState(false);

  const cur = React.useMemo(() => currentWeekKey(), []);
  const weekOptions = React.useMemo(() => recentWeeks(12), []);
  const prevOfCur = React.useMemo(() => shiftWeek(cur, -1), [cur]);
  const isCurrent = week === cur;
  // Only the present week can be created/edited; past weeks are read-only.
  const canEditReward = admin && isCurrent;
  const weekName = (w: string) => (w === cur ? "This week" : w === prevOfCur ? "Last week" : weekTag(w));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const json = await getJSON<{ data: LeaderboardData }>(`/api/leaderboard?week=${week}`);
      setData(json.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [week]);

  React.useEffect(() => { void load(); }, [load]);

  const nameOf = React.useCallback(
    (id: string) => data?.allTime.find((s) => s.memberId === id) ?? null,
    [data]
  );

  const setFulfillment = React.useCallback(
    async (rewardWeek: string, fulfillment: "pending" | "completed") => {
      try {
        const res = await fetch("/api/leaderboard/reward", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ week: rewardWeek, fulfillment }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success(fulfillment === "completed" ? "Marked as given" : "Moved back to pending");
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    },
    [load]
  );

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description="Weekly delivery — tasks, content & project launches."
      >
        {canEditReward && (
          <Button variant="outline" onClick={() => setRewardOpen(true)} className="gap-2">
            <Gift className="size-4" /> {data?.reward ? "Edit reward" : "Set reward"}
          </Button>
        )}
      </PageHeader>

      {/* Week chooser — a simple dropdown; defaults to this week */}
      <div className="mb-6 flex items-center gap-2">
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger className="h-9 w-auto min-w-[150px] gap-2">
            <SelectValue>{weekName(week)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {weekOptions.map((w) => (
              <SelectItem key={w} value={w}>
                {weekName(w)} · {weekLabel(w)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isCurrent && (
          <button
            type="button"
            onClick={() => setWeek(cur)}
            className="text-xs font-medium text-brand hover:underline"
          >
            Back to this week
          </button>
        )}
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Overall report + status + motivation */}
          <OverviewHero data={data} me={user.id} canEdit={canEditReward} nameOf={nameOf} onSet={() => setRewardOpen(true)} />

          {/* Reward stack — earned rewards, pending vs given (visible to all) */}
          <RewardStack stack={data.stack} admin={admin} nameOf={nameOf} onUpdate={setFulfillment} />

          {/* Board */}
          <Tabs defaultValue="week">
            <TabsList className="mb-3">
              <TabsTrigger value="week">This week</TabsTrigger>
              <TabsTrigger value="allTime">All-time</TabsTrigger>
            </TabsList>

            <TabsContent value="week">
              {data.standings.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="Nothing scheduled yet"
                  description="Once work is assigned with a due date this week, standings appear here. Assign tasks from the Tasks page."
                />
              ) : (
                <StandingsList entries={data.standings} youId={user.id} mode="week" />
              )}
            </TabsContent>

            <TabsContent value="allTime">
              {data.allTime.every((e) => e.allTimePoints === 0) ? (
                <EmptyState icon={Trophy} title="No points yet" description="All-time standings build up as members complete their weekly work." />
              ) : (
                <StandingsList entries={data.allTime} youId={user.id} mode="allTime" />
              )}
            </TabsContent>
          </Tabs>

          {/* History */}
          <HistoryList history={data.history} />
        </div>
      )}

      {canEditReward && (
        <RewardDialog
          open={rewardOpen}
          onOpenChange={setRewardOpen}
          week={week}
          existing={data?.reward ?? null}
          onSaved={load}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Top-of-page overall report + status + motivation. */
function OverviewHero({
  data, me, canEdit, nameOf, onSet,
}: {
  data: LeaderboardData;
  me: string;
  canEdit: boolean;
  nameOf: (id: string) => StandingEntry | null;
  onSet: () => void;
}) {
  const { reward, status, winners, assignedCount } = data;
  const h = data.history[0];
  const perfect = h?.perfectMembers ?? 0;
  const totalCompleted = h?.totalCompleted ?? 0;
  const totalAssigned = h?.totalAssigned ?? 0;
  const rate = Math.round((h?.completionRate ?? 0) * 100);
  const remaining = Math.max(0, assignedCount - perfect);
  const pct = assignedCount > 0 ? Math.round((perfect / assignedCount) * 100) : 0;
  const meEntry = data.standings.find((s) => s.memberId === me);

  const earned = status === "earned";
  const missed = status === "missed";

  // Motivational headline + sub-line
  let headline: string;
  let sub: string;
  if (assignedCount === 0) {
    headline = "A fresh week ahead";
    sub = reward ? `Finish everything scheduled to unlock ${reward.title}.` : "Nothing scheduled yet — new work will show up here.";
  } else if (earned) {
    headline = reward ? "Reward unlocked! 🎉" : "Everyone delivered! 🎉";
    sub = reward ? `The whole team earned ${reward.title}.` : "A perfect week for the whole team.";
  } else if (missed) {
    headline = "So close this week";
    sub = reward ? "Not everyone finished — the reward resets next week. Go again." : "Not everyone finished — go again next week.";
  } else {
    headline = reward ? "Let's unlock it together 💪" : "Keep the streak going 💪";
    sub = reward
      ? `${remaining} teammate${remaining === 1 ? "" : "s"} to go — everyone must finish to unlock ${reward.title}.`
      : `${totalCompleted}/${totalAssigned} delivered so far this week.`;
  }

  const barColor = earned ? "bg-[hsl(150_42%_52%)]" : missed ? "bg-destructive" : "bg-brand";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70">
      <div className="grid md:grid-cols-[1.5fr_1fr]">
        {/* Left — reward + motivation + progress */}
        <div className="bg-card p-6">
          <div className="flex items-center gap-3">
            {reward && <span className="text-3xl">{reward.icon || "🏆"}</span>}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {reward ? reward.title : `No reward set for ${weekTag(data.week)}`}
                </p>
                {reward && <StatusPill status={status} />}
              </div>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="truncate">
                  {reward?.description || (canEdit ? "Set a reward the whole team can earn together." : "No reward set for this week.")}
                </span>
                {reward?.date && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/80">
                    <CalendarDays className="size-3" /> {formatDate(reward.date, { month: "short", day: "numeric" })}
                  </span>
                )}
              </p>
            </div>
            {!reward && canEdit && <Button variant="outline" size="sm" onClick={onSet}><Gift className="size-4" /> Set</Button>}
          </div>

          <h2 className="mt-5 text-xl font-bold tracking-tight">{headline}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>

          {assignedCount > 0 && (
            <>
              <div className="mt-4 mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{perfect} of {assignedCount} all-clear</span>
                <span className="font-medium tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
              </div>
            </>
          )}

          {earned && winners.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Winners:</span>
              {winners.map((id) => {
                const w = nameOf(id);
                return (
                  <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-1 text-[11px]">
                    <UserAvatar name={w?.name ?? "?"} src={w?.avatar} className="size-4" />
                    {w?.name ?? "Member"}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Right — overall report */}
        <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 md:border-l md:border-t-0">
          <StatTile label="Participants" value={String(assignedCount)} />
          <StatTile label="Completed" value={`${totalCompleted}/${totalAssigned}`} />
          <StatTile label="Completion" value={`${rate}%`} />
          <StatTile label="Perfect" value={`${perfect}/${assignedCount}`} sub={remaining > 0 ? `${remaining} to go` : "all clear"} />
        </div>
      </div>

      {/* Personal motivation strip */}
      {meEntry && (
        <div className="flex items-center gap-2 border-t border-border/60 bg-card px-6 py-3 text-sm">
          {meEntry.perfect ? (
            <span className="font-medium text-[hsl(150_42%_56%)]">🙌 You&apos;re all clear this week — nice work.</span>
          ) : (
            <span>
              <span className="font-medium">💪 You:</span>{" "}
              {meEntry.completed}/{meEntry.assigned} done — {meEntry.assigned - meEntry.completed} to go.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function RewardStack({
  stack, admin, nameOf, onUpdate,
}: {
  stack: RewardStackItem[];
  admin: boolean;
  nameOf: (id: string) => StandingEntry | null;
  onUpdate: (week: string, fulfillment: "pending" | "completed") => void;
}) {
  void nameOf;
  if (!stack || stack.length === 0) return null;
  const pending = stack.filter((s) => s.reward.fulfillment !== "completed").length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Package className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Reward stack</h2>
        <Badge variant="muted">{pending > 0 ? `${pending} pending` : "all given"}</Badge>
      </div>
      <ul className="space-y-2">
        {stack.map((item) => {
          const done = item.reward.fulfillment === "completed";
          return (
            <li
              key={item.week}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3",
                done ? "border-border/50 bg-muted/20" : "border-border/70"
              )}
            >
              <span className="text-xl">{item.reward.icon || "🏆"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.reward.title}</p>
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                  <span>{weekTag(item.week)} · {item.label}</span>
                  {item.reward.date && (
                    <span className="inline-flex items-center gap-0.5">
                      · <CalendarDays className="size-3" /> {formatDate(item.reward.date, { month: "short", day: "numeric" })}
                    </span>
                  )}
                  <span>· {item.winners.length} winner{item.winners.length === 1 ? "" : "s"}</span>
                </p>
              </div>
              {done ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(150_42%_56%)]">
                  <CheckCircle2 className="size-4" /> Given
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[hsl(38_92%_62%)]">
                  <Clock className="size-4" /> Pending
                </span>
              )}
              {admin && (
                done ? (
                  <Button variant="ghost" size="sm" onClick={() => onUpdate(item.week, "pending")}>Undo</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onUpdate(item.week, "completed")}>Mark given</Button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const RANK_TEXT = ["text-[hsl(45_80%_58%)]", "text-muted-foreground", "text-[hsl(28_55%_55%)]"];

function StandingsList({
  entries, youId, mode,
}: {
  entries: StandingEntry[];
  youId: string;
  mode: "week" | "allTime";
}) {
  return (
    <ul className="divide-y divide-border/50">
      {entries.map((e) => {
        const you = e.memberId === youId;
        const rate = Math.round((mode === "week" ? e.completionRate : e.allTimeCompletionRate) * 100);
        return (
          <li key={e.memberId} className={cn("flex items-center gap-3 py-2.5", you && "-mx-2 rounded-lg bg-brand/[0.04] px-2")}>
            <span className={cn("w-5 shrink-0 text-center text-sm font-semibold tabular-nums", e.rank <= 3 ? RANK_TEXT[e.rank - 1] : "text-muted-foreground/60")}>
              {e.rank}
            </span>
            <UserAvatar name={e.name} src={e.avatar} className="size-7 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">
                {e.name}
                {you && <span className="ml-1.5 text-[11px] text-brand">you</span>}
                {e.perfect && mode === "week" && <Check className="ml-1 inline size-3.5 text-[hsl(150_42%_56%)]" />}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {mode === "week"
                  ? `${e.completed}/${e.assigned} done · ${rate}%`
                  : `${e.perfectWeeks} perfect wk${e.perfectWeeks === 1 ? "" : "s"} · ${rate}%`}
              </p>
            </div>
            <span className="w-16 shrink-0 text-right">
              {mode === "week"
                ? <TrendMark trend={e.trend} delta={e.trendDelta} />
                : <span className="text-[11px] text-muted-foreground">{e.lastActiveAt ? relativeTime(e.lastActiveAt) : "—"}</span>}
            </span>
            <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
              {mode === "week" ? e.weekPoints : e.allTimePoints}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HistoryList({ history }: { history: WeekSummary[] }) {
  const active = history.filter((h) => h.participants > 0 || h.reward);
  if (active.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Week history</h2>
      <ul className="divide-y divide-border/50">
        {active.map((h) => {
          const rate = Math.round(h.completionRate * 100);
          const rateDelta = Math.round(h.deltaRate * 100);
          return (
            <li key={h.week} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{weekTag(h.week)} · {h.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {h.perfectMembers}/{h.participants} perfect · {h.totalCompleted}/{h.totalAssigned} done
                </p>
              </div>
              {h.reward && <StatusPill status={h.status} />}
              <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">{rate}%</span>
              <span className="w-12 shrink-0 text-right">
                {rateDelta > 0 ? <span className="inline-flex items-center gap-0.5 text-[11px] text-[hsl(150_42%_56%)]"><ArrowUp className="size-3" />{rateDelta}</span>
                  : rateDelta < 0 ? <span className="inline-flex items-center gap-0.5 text-[11px] text-destructive"><ArrowDown className="size-3" />{Math.abs(rateDelta)}</span>
                  : <span className="text-[11px] text-muted-foreground/50"><Minus className="size-3" /></span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---- Admin: set / edit / remove the weekly reward ---- */

const EMOJI_CHOICES = ["🏆", "🎁", "💰", "🍕", "🎉", "🌴", "☕", "🎮", "🏖️", "⭐"];

function RewardDialog({
  open, onOpenChange, week, existing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  week: string;
  existing: LeaderboardData["reward"];
  onSaved: () => Promise<void> | void;
}) {
  const [icon, setIcon] = React.useState("🏆");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setIcon(existing?.icon || "🏆");
      setTitle(existing?.title || "");
      setDescription(existing?.description || "");
      setDate(existing?.date || "");
    }
  }, [open, existing]);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/leaderboard/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, icon, title, description, date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to save");
      toast.success("Reward saved");
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leaderboard/reward?week=${week}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Reward removed");
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "Set"} weekly reward</DialogTitle>
          <DialogDescription>
            {weekTag(week)} · {weekLabel(week)} — earned only if every assigned member finishes all their scheduled work.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_CHOICES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg border text-lg transition-colors",
                    icon === e ? "border-brand bg-brand/10" : "border-border hover:bg-muted"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Reward</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team lunch on the house" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Reward date (optional)</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Details (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Anything the team should know…" />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {existing ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove} disabled={saving}>
              <Trash2 className="size-4" /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !title.trim()} className="gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {existing ? "Save" : "Set reward"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
