import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

// Lightweight achievements (PRD.md §4.9). Uniqueness is enforced by the
// (user_id, code) constraint, so awarding is idempotent — we only toast when a
// row is actually inserted (first time earned).
export const ACHIEVEMENTS = {
  first_perfect_day: "🏅 First perfect day — 100 points!",
  seven_day_streak: "🔥 7-day streak! You're unstoppable.",
  first_weekly_win: "🏆 First weekly win — champion!",
} as const;

export type AchievementCode = keyof typeof ACHIEVEMENTS;

export async function award(userId: string, code: AchievementCode) {
  const { error } = await createClient()
    .from("achievements")
    .insert({ user_id: userId, code });
  // No error => newly inserted => celebrate. A unique-violation (already
  // earned) or any other error stays silent.
  if (!error) toast.success(ACHIEVEMENTS[code], { duration: 6000 });
}
