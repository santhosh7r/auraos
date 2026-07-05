import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession, isAdmin } from "@/lib/auth";
import { WeeklyRewardModel } from "@/models";
import { isWeekPast } from "@/lib/week";
import type { WeeklyReward } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEK_RE = /^\d{4}-W\d{2}$/;

function serialize(r: Record<string, unknown>): WeeklyReward {
  return {
    id: String(r._id),
    week: String(r.week),
    title: String(r.title),
    description: String(r.description ?? ""),
    icon: String(r.icon ?? "🏆"),
    date: String(r.date ?? ""),
    fulfillment: r.fulfillment === "completed" ? "completed" : "pending",
    createdBy: String(r.createdBy ?? ""),
    createdAt: r.createdAt ? new Date(r.createdAt as string).toISOString() : "",
  };
}

/** Set (upsert) the reward for a week. Admin only. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only the CEO/admin can set weekly rewards." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const week = String(body.week ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!WEEK_RE.test(week)) {
    return NextResponse.json({ error: "A valid week (YYYY-Www) is required." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "A reward title is required." }, { status: 400 });
  }
  if (isWeekPast(week)) {
    return NextResponse.json({ error: "Past weeks are locked — rewards can only be set for the current week." }, { status: 400 });
  }

  await connectToDatabase();
  const doc = await WeeklyRewardModel.findOneAndUpdate(
    { week },
    {
      $set: {
        title,
        description: String(body.description ?? "").trim(),
        icon: String(body.icon ?? "🏆").trim() || "🏆",
        date: String(body.date ?? "").trim(),
      },
      $setOnInsert: { week, createdBy: session.id, fulfillment: "pending" },
    },
    { new: true, upsert: true }
  ).lean();

  return NextResponse.json({ data: serialize(doc as Record<string, unknown>) }, { status: 201 });
}

/** Update fulfillment status (and/or date) of an existing reward. Admin only. */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only the CEO/admin can update rewards." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const week = String(body.week ?? "").trim();
  if (!WEEK_RE.test(week)) {
    return NextResponse.json({ error: "A valid week is required." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.fulfillment === "completed" || body.fulfillment === "pending") {
    update.fulfillment = body.fulfillment;
  }
  if (typeof body.date === "string") update.date = body.date.trim();
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await connectToDatabase();
  const doc = await WeeklyRewardModel.findOneAndUpdate({ week }, { $set: update }, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  return NextResponse.json({ data: serialize(doc as Record<string, unknown>) });
}

/** Remove the reward for a week. Admin only. */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.role)) {
    return NextResponse.json({ error: "Only the CEO/admin can remove weekly rewards." }, { status: 403 });
  }

  const week = String(new URL(req.url).searchParams.get("week") ?? "").trim();
  if (!WEEK_RE.test(week)) {
    return NextResponse.json({ error: "A valid week is required." }, { status: 400 });
  }
  if (isWeekPast(week)) {
    return NextResponse.json({ error: "Past weeks are locked." }, { status: 400 });
  }

  await connectToDatabase();
  await WeeklyRewardModel.findOneAndDelete({ week });
  return NextResponse.json({ ok: true });
}
