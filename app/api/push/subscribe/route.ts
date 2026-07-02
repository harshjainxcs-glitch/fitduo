import { NextResponse } from "next/server";

// Upserts a browser PushSubscription into push_subscriptions — Prompt 1.5.1/1.5.2 (CLAUDE.md §8).
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
