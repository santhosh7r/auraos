/* ============================================================
   AURA OS — ISO week helpers (Mon–Sun)
   A "week key" is `${isoWeekYear}-W${weekNumber}` e.g. "2026-W27".
   Weekly rewards, leaderboard standings and history all bucket by
   the ISO week a task's due date falls in.
   ============================================================ */

import {
  getISOWeek, getISOWeekYear, startOfISOWeek, endOfISOWeek,
  setISOWeek, setISOWeekYear, isBefore, format,
} from "date-fns";

/** Build the week key for a given date. */
export function weekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

/** The week key for the current moment. */
export function currentWeekKey(): string {
  return weekKey(new Date());
}

/** Parse a week key back into its Monday (start of the ISO week). */
export function weekStart(key: string): Date {
  const [yStr, wStr] = key.split("-W");
  const year = Number(yStr);
  const week = Number(wStr);
  // Jan 4 is always in ISO week 1 of its ISO year — a safe anchor.
  let d = new Date(year, 0, 4);
  d = setISOWeekYear(d, year);
  d = setISOWeek(d, week);
  return startOfISOWeek(d);
}

/** The inclusive Sunday end of the ISO week. */
export function weekEnd(key: string): Date {
  return endOfISOWeek(weekStart(key));
}

/** Range for a week key. */
export function weekRange(key: string): { start: Date; end: Date } {
  const start = weekStart(key);
  return { start, end: endOfISOWeek(start) };
}

/** Has this week fully ended (its Sunday is in the past)? */
export function isWeekPast(key: string, now: Date = new Date()): boolean {
  return isBefore(weekEnd(key), now);
}

/** Is this the ongoing week? */
export function isCurrentWeek(key: string, now: Date = new Date()): boolean {
  return key === weekKey(now);
}

/** Shift a week key by `delta` weeks (negative = earlier). */
export function shiftWeek(key: string, delta: number): string {
  const start = weekStart(key);
  const shifted = new Date(start);
  shifted.setDate(shifted.getDate() + delta * 7);
  return weekKey(shifted);
}

/** N most recent week keys ending at `endKey` (default current), newest first. */
export function recentWeeks(count: number, endKey: string = currentWeekKey()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(shiftWeek(endKey, -i));
  return out;
}

/** Short human range, e.g. "Jul 1 – 7" or "Jun 30 – Jul 6". */
export function weekLabel(key: string): string {
  const { start, end } = weekRange(key);
  const sameMonth = start.getMonth() === end.getMonth();
  const left = format(start, "MMM d");
  const right = sameMonth ? format(end, "d") : format(end, "MMM d");
  return `${left} – ${right}`;
}

/** Just the "W27" short tag. */
export function weekTag(key: string): string {
  const [, w] = key.split("-W");
  return `W${w}`;
}
