import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { UserModel, TaskModel, ContentPlanModel, ProjectModel, WeeklyRewardModel } from "@/models";
import {
  weekKey, currentWeekKey, weekLabel, shiftWeek, recentWeeks,
  isWeekPast, isCurrentWeek,
} from "@/lib/week";
import type {
  LeaderboardData, StandingEntry, WeekSummary, WeeklyReward,
  RewardStatus, Trend, RewardStackItem,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_WEEKS = 8;

/** Points: 10 per completed task + a 25-pt bonus for a perfect week. */
function weekPoints(assigned: number, completed: number): number {
  const perfect = assigned > 0 && completed === assigned;
  return completed * 10 + (perfect ? 25 : 0);
}

type Bucket = { assigned: number; completed: number };
type WeekBuckets = Map<string, Bucket>; // memberId -> bucket

function emptyBucket(): Bucket {
  return { assigned: 0, completed: 0 };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const selected = url.searchParams.get("week") || currentWeekKey();

  await connectToDatabase();

  // Board excludes admins — they run the board, they don't compete.
  const memberDocs = await UserModel.find({
    role: { $ne: "admin" },
    status: { $ne: "inactive" },
  })
    .select("name avatar title lastActiveAt role status")
    .sort({ createdAt: 1 })
    .lean();

  const members = memberDocs.map((m) => ({
    id: String(m._id),
    name: m.name as string,
    avatar: (m.avatar as string) || undefined,
    title: (m.title as string) || "",
    lastActiveAt: m.lastActiveAt ? new Date(m.lastActiveAt as string).toISOString() : "",
  }));
  const memberIds = new Set(members.map((m) => m.id));

  // Everything an agency member is on the hook to deliver in a week counts as
  // a "work item": a task, a scheduled content piece, or a project delivery.
  // Each item is owned by one member and buckets into the ISO week its
  // scheduled date falls in. Undated items belong to no week.
  //   - Task      → owner: assignee, date: dueDate,  done: status "done"
  //   - Content   → owner: assignee, date: date,     done: status "published"
  //   - Project   → owner: lead,     date: deadline, done: status "completed"
  // Self-created / self-owned work is included automatically — bucketing is by
  // owner, not by who created it.
  const [tasks, contents, projects] = await Promise.all([
    TaskModel.find({ dueDate: { $ne: "" } }).select("assignee dueDate status").lean(),
    ContentPlanModel.find({ date: { $ne: "" } }).select("assignee date status").lean(),
    ProjectModel.find({ deadline: { $ne: "" } }).select("lead deadline status").lean(),
  ]);

  type Item = { owner: string; date: string; done: boolean };
  const items: Item[] = [
    ...tasks.map((t) => ({ owner: String(t.assignee ?? ""), date: String(t.dueDate ?? ""), done: t.status === "done" })),
    ...contents.map((c) => ({ owner: String(c.assignee ?? ""), date: String(c.date ?? ""), done: c.status === "published" })),
    ...projects.map((p) => ({ owner: String(p.lead ?? ""), date: String(p.deadline ?? ""), done: p.status === "completed" })),
  ];

  // week -> (memberId -> bucket)
  const byWeek = new Map<string, WeekBuckets>();
  for (const it of items) {
    if (!it.owner || !memberIds.has(it.owner) || !it.date) continue;
    const d = new Date(it.date);
    if (Number.isNaN(d.getTime())) continue;
    const wk = weekKey(d);
    let wb = byWeek.get(wk);
    if (!wb) { wb = new Map(); byWeek.set(wk, wb); }
    let b = wb.get(it.owner);
    if (!b) { b = emptyBucket(); wb.set(it.owner, b); }
    b.assigned += 1;
    if (it.done) b.completed += 1;
  }

  const bucketOf = (wk: string, memberId: string): Bucket =>
    byWeek.get(wk)?.get(memberId) ?? emptyBucket();

  // All-time aggregates per member (across every week).
  const allTimePoints = new Map<string, number>();
  const allTimeAssigned = new Map<string, number>();
  const allTimeCompleted = new Map<string, number>();
  const perfectWeeks = new Map<string, number>();
  for (const [, wb] of byWeek) {
    for (const [memberId, b] of wb) {
      allTimePoints.set(memberId, (allTimePoints.get(memberId) ?? 0) + weekPoints(b.assigned, b.completed));
      allTimeAssigned.set(memberId, (allTimeAssigned.get(memberId) ?? 0) + b.assigned);
      allTimeCompleted.set(memberId, (allTimeCompleted.get(memberId) ?? 0) + b.completed);
      if (b.assigned > 0 && b.completed === b.assigned) {
        perfectWeeks.set(memberId, (perfectWeeks.get(memberId) ?? 0) + 1);
      }
    }
  }

  // ---- Rewards ----
  const rewardDocs = await WeeklyRewardModel.find({}).lean();
  const rewardByWeek = new Map<string, WeeklyReward>();
  for (const r of rewardDocs) {
    rewardByWeek.set(String(r.week), {
      id: String(r._id),
      week: String(r.week),
      title: String(r.title),
      description: String(r.description ?? ""),
      icon: String(r.icon ?? "🏆"),
      date: String(r.date ?? ""),
      fulfillment: (r.fulfillment === "completed" ? "completed" : "pending"),
      createdBy: String(r.createdBy ?? ""),
      createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : "",
    });
  }

  // ---- Standings builder for a given week ----
  const prevWeek = shiftWeek(selected, -1);

  function trendFor(cur: number, prev: number, hadPrev: boolean): { trend: Trend; delta: number } {
    if (!hadPrev) return { trend: "new", delta: cur };
    const delta = cur - prev;
    if (delta > 0) return { trend: "up", delta };
    if (delta < 0) return { trend: "down", delta };
    return { trend: "flat", delta: 0 };
  }

  function buildEntry(memberId: string): StandingEntry {
    const m = members.find((x) => x.id === memberId)!;
    const b = bucketOf(selected, memberId);
    const pb = byWeek.get(prevWeek)?.get(memberId);
    const hadPrev = !!pb;
    const { trend, delta } = trendFor(b.completed, pb?.completed ?? 0, hadPrev);
    return {
      memberId,
      name: m.name,
      avatar: m.avatar,
      title: m.title,
      rank: 0,
      assigned: b.assigned,
      completed: b.completed,
      completionRate: b.assigned > 0 ? b.completed / b.assigned : 0,
      perfect: b.assigned > 0 && b.completed === b.assigned,
      weekPoints: weekPoints(b.assigned, b.completed),
      allTimePoints: allTimePoints.get(memberId) ?? 0,
      allTimeAssigned: allTimeAssigned.get(memberId) ?? 0,
      allTimeCompleted: allTimeCompleted.get(memberId) ?? 0,
      allTimeCompletionRate: (allTimeAssigned.get(memberId) ?? 0) > 0
        ? (allTimeCompleted.get(memberId) ?? 0) / (allTimeAssigned.get(memberId) ?? 1)
        : 0,
      perfectWeeks: perfectWeeks.get(memberId) ?? 0,
      lastActiveAt: m.lastActiveAt,
      trend,
      trendDelta: delta,
    };
  }

  const activeTs = (s: string) => (s ? new Date(s).getTime() : 0);

  // "This week" board — members with at least one task this week, ranked.
  const standings = members
    .map((m) => buildEntry(m.id))
    .filter((e) => e.assigned > 0)
    .sort((a, b) =>
      b.weekPoints - a.weekPoints ||
      b.completed - a.completed ||
      b.completionRate - a.completionRate ||
      activeTs(b.lastActiveAt) - activeTs(a.lastActiveAt) ||
      a.name.localeCompare(b.name)
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // All-time / season board — every member, by cumulative points.
  const allTime = members
    .map((m) => buildEntry(m.id))
    .sort((a, b) =>
      b.allTimePoints - a.allTimePoints ||
      activeTs(b.lastActiveAt) - activeTs(a.lastActiveAt) ||
      a.name.localeCompare(b.name)
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // ---- Reward status for the selected week ----
  const assignedMembers = members.filter((m) => bucketOf(selected, m.id).assigned > 0);
  const assignedCount = assignedMembers.length;
  const allPerfect =
    assignedCount > 0 &&
    assignedMembers.every((m) => {
      const b = bucketOf(selected, m.id);
      return b.completed === b.assigned;
    });
  const reward = rewardByWeek.get(selected) ?? null;
  const isPast = isWeekPast(selected);
  const isCurrent = isCurrentWeek(selected);

  function statusFor(wk: string): RewardStatus {
    const r = rewardByWeek.get(wk);
    if (!r) return "none";
    const assigned = members.filter((m) => bucketOf(wk, m.id).assigned > 0);
    if (assigned.length === 0) return "pending";
    const perfect = assigned.every((m) => {
      const b = bucketOf(wk, m.id);
      return b.completed === b.assigned;
    });
    if (perfect) return "earned";
    return isWeekPast(wk) ? "missed" : "in_progress";
  }

  const status = statusFor(selected);
  const winners = status === "earned" ? assignedMembers.map((m) => m.id) : [];

  // ---- History (recent weeks, newest first, with improvement deltas) ----
  const historyKeys = recentWeeks(HISTORY_WEEKS, selected);
  const rawHistory = historyKeys.map((wk): Omit<WeekSummary, "deltaCompleted" | "deltaRate"> => {
    const assigned = members.filter((m) => bucketOf(wk, m.id).assigned > 0);
    let totalAssigned = 0, totalCompleted = 0, perfectMembers = 0;
    for (const m of assigned) {
      const b = bucketOf(wk, m.id);
      totalAssigned += b.assigned;
      totalCompleted += b.completed;
      if (b.completed === b.assigned) perfectMembers += 1;
    }
    return {
      week: wk,
      label: weekLabel(wk),
      reward: rewardByWeek.get(wk) ?? null,
      status: statusFor(wk),
      participants: assigned.length,
      perfectMembers,
      totalAssigned,
      totalCompleted,
      completionRate: totalAssigned > 0 ? totalCompleted / totalAssigned : 0,
    };
  });

  // Improvement vs the previous (older) week in the series.
  const history: WeekSummary[] = rawHistory.map((h, i) => {
    const older = rawHistory[i + 1];
    return {
      ...h,
      deltaCompleted: h.totalCompleted - (older?.totalCompleted ?? 0),
      deltaRate: h.completionRate - (older?.completionRate ?? 0),
    };
  });

  // ---- Reward stack: every earned reward (pending + completed), newest first ----
  const stack: RewardStackItem[] = [];
  for (const [wk, r] of rewardByWeek) {
    if (statusFor(wk) !== "earned") continue;
    const wkWinners = members.filter((m) => bucketOf(wk, m.id).assigned > 0).map((m) => m.id);
    stack.push({ week: wk, label: weekLabel(wk), reward: r, winners: wkWinners });
  }
  stack.sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));

  const payload: LeaderboardData = {
    week: selected,
    label: weekLabel(selected),
    reward,
    status,
    standings,
    allTime,
    winners,
    assignedCount,
    history,
    stack,
    isPast,
    isCurrent,
  };

  return NextResponse.json({ data: payload });
}
