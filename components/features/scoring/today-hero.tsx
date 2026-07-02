"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { deriveDaily } from "@/lib/today";
import { weekStartIST } from "@/lib/utils/date";
import { pickMotivation } from "@/components/features/motivation/messages";
import { Confetti } from "@/components/features/motivation/confetti";
import { AchievementsWatcher } from "@/components/features/motivation/achievements-watcher";
import type {
  MealLog,
  PlanItem,
  Profile,
  WaterLog,
  WorkoutLog,
} from "@/lib/types/database.types";
import { Ring } from "@/components/ring";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TodayHero({
  userId,
  profile,
  date,
}: {
  userId: string;
  profile: Profile;
  date: string;
}) {
  const supabase = createClient();
  const weekStart = weekStartIST(date);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const { data: planItems = [] } = useQuery({
    queryKey: ["plan_items", userId],
    queryFn: async (): Promise<PlanItem[]> => {
      const { data, error } = await supabase
        .from("plan_items")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data: mealLogs = [] } = useQuery({
    queryKey: ["meal_logs", userId, date],
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date);
      if (error) throw error;
      return data;
    },
  });
  const { data: waterLogs = [] } = useQuery({
    queryKey: ["water_logs", userId, date],
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date);
      if (error) throw error;
      return data;
    },
  });
  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["workout_logs", userId, weekStart],
    queryFn: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", date);
      if (error) throw error;
      return data;
    },
  });

  const d = deriveDaily({
    profile,
    date,
    planItems,
    mealLogs,
    waterLogs,
    workoutLogs,
  });

  const message = pickMotivation(d.score.total, date);

  const mealProgress =
    d.plannedMeals > 0 ? d.completedMeals / d.plannedMeals : 0;
  const waterProgress =
    d.waterTargetMl > 0 ? d.waterLoggedMl / d.waterTargetMl : 0;
  const workoutProgress = d.isWorkoutDay ? (d.workoutLogged ? 1 : 0) : 1;

  return (
    <section className="relative">
      <AchievementsWatcher userId={userId} todayTotal={d.score.total} />
      {d.score.total >= 100 ? <Confetti /> : null}

      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-5">
        <button
          type="button"
          onClick={() => setBreakdownOpen(true)}
          className="flex flex-col items-center"
          aria-label="Show score breakdown"
        >
          <span className="text-5xl font-bold tabular-nums">
            {d.score.total}
          </span>
          <span className="text-xs text-muted-foreground">of 100 points</span>
        </button>

        <div className="grid w-full grid-cols-3 gap-2">
          <MiniRing
            label="Meals"
            progress={mealProgress}
            color="stroke-emerald-500"
            caption={
              d.plannedMeals > 0
                ? `${d.completedMeals}/${d.plannedMeals}`
                : "—"
            }
          />
          <MiniRing
            label="Water"
            progress={waterProgress}
            color="stroke-sky-500"
            caption={`${Math.round(waterProgress * 100)}%`}
          />
          <MiniRing
            label="Workout"
            progress={workoutProgress}
            color="stroke-amber-500"
            caption={
              !d.isWorkoutDay ? "Rest" : d.workoutLogged ? "Done" : "Todo"
            }
          />
        </div>

        <p className="text-center text-sm text-muted-foreground">{message}</p>
      </div>

      {d.hasCalorieData ? (
        <div className="mt-3 flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Calories</span>
          <span className="tabular-nums">
            {d.actualCalories}
            {d.plannedCalories > 0 ? (
              <span className="text-muted-foreground">
                {" "}
                / {d.plannedCalories} planned
              </span>
            ) : null}
          </span>
        </div>
      ) : null}

      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Today&apos;s points</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <Row label="Meals" value={d.score.mealPoints} />
            <Row label="Water" value={d.score.waterPoints} />
            <Row label="Workout" value={d.score.workoutPoints} />
            <div className="my-1 border-t" />
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{d.score.total}</span>
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              Weights redistribute across the categories that apply today, so a
              full day is always 100. Calories don&apos;t affect points.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MiniRing({
  label,
  progress,
  color,
  caption,
}: {
  label: string;
  progress: number;
  color: string;
  caption: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Ring progress={progress} size={72} stroke={7} ringClassName={color}>
        <span className="text-[11px] font-medium tabular-nums">{caption}</span>
      </Ring>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{Math.round(value)}</span>
    </div>
  );
}
