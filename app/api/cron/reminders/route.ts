import { NextResponse } from "next/server";

// Vercel Cron target (guarded by CRON_SECRET) — reminder scheduler, Prompt 1.5.3 (PRD.md §4.5).
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
