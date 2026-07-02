"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { award } from "@/lib/achievements";
import { currentStreak } from "@/lib/streaks";
import { todayIST } from "@/lib/utils/date";

// Watches live signals and unlocks achievements (idempotent). Mounted on Today.
export function AchievementsWatcher({
  userId,
  todayTotal,
}: {
  userId: string;
  todayTotal: number;
}) {
  const today = todayIST();

  const { data: streak = 0 } = useQuery({
    queryKey: ["daily_scores", userId, "streak-count"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await createClient()
        .from("daily_scores")
        .select("log_date,total")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(120);
      if (error) throw error;
      return currentStreak(data ?? [], today);
    },
  });

  const { data: hasWin = false } = useQuery({
    queryKey: ["weekly_results", "won", userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await createClient()
        .from("weekly_results")
        .select("id")
        .eq("winner_id", userId)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  useEffect(() => {
    if (todayTotal >= 100) award(userId, "first_perfect_day");
  }, [todayTotal, userId]);

  useEffect(() => {
    if (streak >= 7) award(userId, "seven_day_streak");
  }, [streak, userId]);

  useEffect(() => {
    if (hasWin) award(userId, "first_weekly_win");
  }, [hasWin, userId]);

  return null;
}
