import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, type PushPayload } from "@/lib/push/webpush";
import { resolveNotifPrefs } from "@/lib/constants";
import {
  dayOfWeekIST,
  hourIST,
  minutesOfDayIST,
  todayIST,
  weekStartIST,
} from "@/lib/utils/date";
import {
  inQuietHours,
  mealReminderDue,
  toMinutes,
  waterReminderDue,
} from "@/lib/reminders";
import type { Profile } from "@/lib/types/database.types";

export const runtime = "nodejs";
// Never cache — it's a scheduled job.
export const dynamic = "force-dynamic";

// Vercel Cron target (schedule in vercel.json). Protected by CRON_SECRET, which
// Vercel sends as `Authorization: Bearer <CRON_SECRET>`. Dry-run locally with:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        "http://localhost:3000/api/cron/reminders?dryRun=1"
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const admin = createAdminClient();

  const now = new Date();
  const date = todayIST(now);
  const dow = dayOfWeekIST(date);
  const hour = hourIST(now);
  const nowMin = minutesOfDayIST(now);
  const weekStart = weekStartIST(date);

  const actions: Array<{ userId: string; category: string; key: string; title: string }> = [];

  const { data: profiles } = await admin.from("profiles").select("*");
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, dryRun, date, actions });
  }

  // Reserve a dedupe slot; returns true if this is the first time (so we send).
  async function reserve(userId: string, category: string, key: string) {
    if (dryRun) return true;
    const { error } = await admin
      .from("notification_sends")
      .insert({ user_id: userId, category, dedupe_key: key });
    return !error; // unique violation / missing table => skip
  }

  async function fire(
    userId: string,
    category: string,
    key: string,
    payload: PushPayload,
  ) {
    const first = await reserve(userId, category, key);
    if (!first) return;
    actions.push({ userId, category, key, title: payload.title });
    if (!dryRun) await sendPush(userId, payload);
  }

  for (const profile of profiles as Profile[]) {
    const prefs = resolveNotifPrefs(profile.notif_prefs);
    const quietNow = inQuietHours(nowMin, prefs.quiet_hours);
    const partner = profiles.find((p) => p.id !== profile.id) as
      | Profile
      | undefined;

    // --- Water ---
    if (prefs.water && !quietNow) {
      const { data: waterRows } = await admin
        .from("water_logs")
        .select("amount_ml")
        .eq("user_id", profile.id)
        .eq("log_date", date);
      const logged = (waterRows ?? []).reduce((s, r) => s + r.amount_ml, 0);
      const { due, slot } = waterReminderDue({
        nowMin,
        wakeStartMin: toMinutes(prefs.quiet_hours.end),
        wakeEndMin: toMinutes(prefs.quiet_hours.start),
        targetMl: profile.water_target_ml,
        loggedMl: logged,
        intervalMin: prefs.water_interval_min,
      });
      if (due) {
        const remaining = Math.max(0, profile.water_target_ml - logged);
        await fire(profile.id, "water", `${date}:w${slot}`, {
          title: "Time to hydrate 💧",
          body: `${remaining} ml to go today — grab a bottle.`,
          url: "/today",
          tag: "water",
        });
      }
    }

    // --- Meals (planned, past target time, not yet logged) ---
    if (prefs.meals && !quietNow) {
      const { data: planned } = await admin
        .from("plan_items")
        .select("*")
        .eq("user_id", profile.id)
        .eq("day_of_week", dow)
        .eq("is_active", true)
        .not("target_time", "is", null);
      const { data: logs } = await admin
        .from("meal_logs")
        .select("plan_item_id")
        .eq("user_id", profile.id)
        .eq("log_date", date);
      const loggedItems = new Set(
        (logs ?? []).map((l) => l.plan_item_id).filter(Boolean),
      );
      for (const item of planned ?? []) {
        if (loggedItems.has(item.id)) continue;
        if (!item.target_time || !mealReminderDue(item.target_time, nowMin)) continue;
        await fire(profile.id, "meal", `meal:${item.id}:${date}`, {
          title: "Meal reminder 🍽️",
          body: `Time for ${item.title} — tap to log it.`,
          url: "/today",
          tag: `meal-${item.id}`,
        });
      }
    }

    // --- Partner activity (workout logged today) ---
    if (prefs.partner && partner && !quietNow) {
      const { data: pw } = await admin
        .from("workout_logs")
        .select("id")
        .eq("user_id", partner.id)
        .eq("log_date", date)
        .limit(1);
      if ((pw?.length ?? 0) > 0) {
        const name = partner.display_name.split(" ")[0];
        await fire(profile.id, "partner", `workout:${partner.id}:${date}`, {
          title: "Your partner is moving 💪",
          body: `${name} just logged a workout. Your turn?`,
          url: "/us",
          tag: "partner",
        });
      }
    }

    // --- Weekly open (Monday morning) / close (Sunday night) ---
    if (prefs.weekly) {
      if (dow === 0 && hour >= 8) {
        await fire(profile.id, "weekly_open", weekStart, {
          title: "New week, fresh start 🗓️",
          body: "A clean slate — grab the first points of the week.",
          url: "/weekly",
          tag: "weekly",
        });
      }
      if (dow === 6 && hour >= 20) {
        const { data: scores } = await admin
          .from("weekly_scores")
          .select("user_id,total")
          .eq("week_start", weekStart);
        const mine = Number(
          scores?.find((s) => s.user_id === profile.id)?.total ?? 0,
        );
        const theirs = partner
          ? Number(scores?.find((s) => s.user_id === partner.id)?.total ?? 0)
          : 0;
        const verdict =
          !partner || mine === theirs
            ? "It's neck and neck!"
            : mine > theirs
              ? "You're winning this week! 🏆"
              : "You're behind — finish strong!";
        await fire(profile.id, "weekly_close", weekStart, {
          title: "Week wrap-up",
          body: `You ${mine} vs ${theirs}. ${verdict}`,
          url: "/weekly",
          tag: "weekly",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, dryRun, date, sent: actions.length, actions });
}
