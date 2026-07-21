"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronRight, Heart, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayIST, addDays } from "@/lib/utils/date";
import { predictCycle, painTips } from "@/lib/cycle";
import type { CycleDay, Profile, WorkoutLog } from "@/lib/types/database.types";
import { cn } from "@/lib/utils";

// Shown on /today only for cycle-trackers who are menstruating: a warm nudge
// that their partner is there, pain tips (first 3 days), and the self-care
// movement-points claim (rest in lieu of a workout).
export function TodayCycleCard({
  userId,
  profile,
  partnerName,
}: {
  userId: string;
  profile: Profile;
  partnerName: string;
}) {
  const qc = useQueryClient();
  const today = todayIST();

  const { data: days = [] } = useQuery({
    queryKey: ["cycle_days", userId],
    queryFn: async (): Promise<CycleDay[]> => {
      const { data, error } = await createClient()
        .from("cycle_days")
        .select("*")
        .eq("user_id", userId)
        .gte("day", addDays(today, -400))
        .order("day");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayWorkouts = [] } = useQuery({
    queryKey: ["workout_logs", userId, today],
    queryFn: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await createClient()
        .from("workout_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", today);
      if (error) throw error;
      return data;
    },
  });

  const pred = useMemo(
    () =>
      predictCycle(
        days.filter((d) => d.flow).map((d) => d.day),
        today,
        profile.cycle_avg_length,
        profile.cycle_period_length,
      ),
    [days, today, profile.cycle_avg_length, profile.cycle_period_length],
  );

  if (!pred.isMenstruating) return null;
  const claimed = todayWorkouts.length > 0;
  const showTips = (pred.periodDay ?? 1) <= 3;

  async function claim() {
    if (claimed) return;
    const { error } = await createClient().from("workout_logs").insert({
      user_id: userId,
      log_date: today,
      type: "Period self-care",
      source: "cycle_selfcare",
      note: "Rest & self-care in lieu of a workout 💛",
    });
    if (error) {
      toast.error("Couldn't claim.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["workout_logs", userId, today] });
    qc.invalidateQueries({ queryKey: ["workout_logs"] });
    toast.success("Movement points claimed — rest up 💛");
  }

  return (
    <section className="space-y-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/40 dark:bg-rose-950/30">
      <div className="flex items-start gap-2">
        <Heart className="mt-0.5 size-5 shrink-0 fill-rose-500 text-rose-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
            Period · Day {pred.periodDay}
          </p>
          <p className="text-sm text-rose-800 dark:text-rose-200/90">
            {partnerName} is here for you 💛 Rest, stay warm, and please eat well
            today.
          </p>
        </div>
      </div>

      {showTips ? (
        <p className="rounded-2xl bg-white/70 p-3 text-xs text-rose-900 dark:bg-rose-900/20 dark:text-rose-100">
          💡 {painTips()[(pred.periodDay ?? 1) - 1] ?? painTips()[0]}
        </p>
      ) : null}

      <button
        type="button"
        onClick={claim}
        disabled={claimed}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition",
          claimed
            ? "bg-rose-200 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200"
            : "bg-rose-500 text-white active:scale-[0.98]",
        )}
      >
        <Sparkles className="size-4" />
        {claimed
          ? "Movement points claimed 💛"
          : "Claim movement points with self-care"}
      </button>

      <Link
        href="/cycle"
        className="flex items-center justify-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-300"
      >
        Open cycle tracker <ChevronRight className="size-3.5" />
      </Link>
    </section>
  );
}
