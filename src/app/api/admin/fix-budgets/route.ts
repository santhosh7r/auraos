import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/lib/auth";
import { ProjectModel } from "@/models";
import { CURRENCY_META } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ *
 * One-time cleanup: fix project budgets drifted by the old integer-USD
 * rounding (e.g. ₹7000 was flattened to $84, which reads back as ₹6972).
 *
 * GET /api/admin/fix-budgets  (admin session)
 *
 * Snaps each project's stored USD budget so its displayed INR value is a
 * clean multiple of 100, then stores the exact fractional base so it
 * round-trips precisely from now on. Idempotent — safe to re-run.
 * Remove this route once you've run it.
 * ------------------------------------------------------------------ */

const RATE = CURRENCY_META.INR.rate; // 83
const SNAP = 100; // round displayed INR to the nearest ₹100

export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only." }, { status: 403 });
  }

  await connectToDatabase();
  const projects = await ProjectModel.find({}).lean();

  const changed: { name: string; beforeINR: number; afterINR: number }[] = [];
  for (const p of projects as { _id: unknown; name?: string; budget?: number }[]) {
    const budget = p.budget || 0;
    if (budget === 0) continue;

    const inr = budget * RATE;
    const snappedInr = Math.round(inr / SNAP) * SNAP;
    const newBudget = snappedInr / RATE;

    // Only touch records whose displayed value actually moves.
    if (Math.abs(newBudget - budget) < 1e-9) continue;

    await ProjectModel.updateOne({ _id: p._id }, { $set: { budget: newBudget } });
    changed.push({ name: p.name ?? "—", beforeINR: Math.round(inr), afterINR: snappedInr });
  }

  return NextResponse.json({
    ok: true,
    scanned: projects.length,
    updated: changed.length,
    changed,
  });
}
