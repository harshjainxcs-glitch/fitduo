"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deriveDaily } from "@/lib/today";
import { currentStreak } from "@/lib/streaks";
import { signedPhotoUrl } from "@/lib/storage";
import { todayIST, weekStartIST, weekDatesIST, dayOfWeekIST } from "@/lib/utils/date";
import type {
  MealGroup,
  MealLog,
  PlanItem,
  Profile,
  WaterLog,
  WorkoutLog,
} from "@/lib/types/database.types";
import { Ring } from "@/components/ring";
import { Feed } from "@/components/features/partner/feed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UsView({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const date = todayIST();
  const weekStart = weekStartIST(date);

  // Put the current user first.
  const ordered = [...profiles].sort((a, b) =>
    a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0,
  );

  const { data: weekly = [] } = useQuery({
    queryKey: ["weekly_scores", weekStart],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("weekly_scores")
        .select("*")
        .eq("week_start", weekStart);
      if (error) throw error;
      return data;
    },
  });

  const weekTotals = new Map(weekly.map((w) => [w.user_id, Number(w.total)]));
  const daysLeft = 6 - dayOfWeekIST(date);

  const a = ordered[0];
  const b = ordered[1];
  const aTotal = weekTotals.get(a?.id ?? "") ?? 0;
  const bTotal = b ? (weekTotals.get(b.id) ?? 0) : 0;
  const leader =
    !b || aTotal === bTotal ? null : aTotal > bTotal ? a : b;
  const gap = Math.abs(aTotal - bTotal);

  return (
    <div className="space-y-6 px-4 py-2">
      {/* Head-to-head */}
      <div className="rounded-2xl border bg-card p-4 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          This week
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-3xl font-bold tabular-nums">
          <span>{aTotal}</span>
          <span className="text-base text-muted-foreground">vs</span>
          <span>{bTotal}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {leader
            ? `${leader.display_name.split(" ")[0]} leads by ${gap}`
            : "All square"}
          {" · "}
          {daysLeft === 0 ? "final day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        </p>
      </div>

      {/* Partner columns */}
      <div className="grid grid-cols-2 gap-3">
        {ordered.map((p) => (
          <PartnerColumn
            key={p.id}
            profile={p}
            date={date}
            weekStart={weekStart}
            isCurrent={p.id === currentUserId}
          />
        ))}
      </div>

      {/* Shared moments feed */}
      <div className="space-y-3">
        <h2 className="text-base font-bold">Shared moments</h2>
        <Feed profiles={profiles} currentUserId={currentUserId} />
      </div>
    </div>
  );
}

function PartnerColumn({
  profile,
  date,
  weekStart,
  isCurrent,
}: {
  profile: Profile;
  date: string;
  weekStart: string;
  isCurrent: boolean;
}) {
  const supabase = createClient();
  const uid = profile.id;

  const { data: mealGroups = [] } = useQuery({
    queryKey: ["meal_groups", uid],
    queryFn: async (): Promise<MealGroup[]> => {
      const { data, error } = await supabase
        .from("meal_groups")
        .select("*")
        .eq("user_id", uid);
      if (error) throw error;
      return data;
    },
  });
  const { data: planItems = [] } = useQuery({
    queryKey: ["plan_items", uid],
    queryFn: async (): Promise<PlanItem[]> => {
      const { data, error } = await supabase
        .from("plan_items")
        .select("*")
        .eq("user_id", uid);
      if (error) throw error;
      return data;
    },
  });
  const { data: mealLogs = [] } = useQuery({
    queryKey: ["meal_logs", uid, date],
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", uid)
        .eq("log_date", date);
      if (error) throw error;
      return data;
    },
  });
  const { data: waterLogs = [] } = useQuery({
    queryKey: ["water_logs", uid, date],
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("*")
        .eq("user_id", uid)
        .eq("log_date", date);
      if (error) throw error;
      return data;
    },
  });
  const { data: workoutLogs = [] } = useQuery({
    queryKey: ["workout_logs", uid, weekStart],
    queryFn: async (): Promise<WorkoutLog[]> => {
      const dates = weekDatesIST(date);
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("log_date", dates[0])
        .lte("log_date", dates[6]);
      if (error) throw error;
      return data;
    },
  });
  const { data: streak = 0 } = useQuery({
    queryKey: ["daily_scores", uid],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("daily_scores")
        .select("log_date,total")
        .eq("user_id", uid)
        .order("log_date", { ascending: false })
        .limit(90);
      if (error) throw error;
      return currentStreak(data ?? [], date);
    },
  });
  const { data: photoUrl = null } = useQuery({
    queryKey: ["latest_photo", uid],
    queryFn: async (): Promise<string | null> => {
      const [meals, workouts] = await Promise.all([
        supabase
          .from("meal_logs")
          .select("photo_path,logged_at")
          .eq("user_id", uid)
          .not("photo_path", "is", null)
          .order("logged_at", { ascending: false })
          .limit(1),
        supabase
          .from("workout_logs")
          .select("photo_path,logged_at")
          .eq("user_id", uid)
          .not("photo_path", "is", null)
          .order("logged_at", { ascending: false })
          .limit(1),
      ]);
      const candidates = [meals.data?.[0], workouts.data?.[0]].filter(
        (x): x is { photo_path: string | null; logged_at: string } => !!x,
      );
      candidates.sort((x, y) => y.logged_at.localeCompare(x.logged_at));
      const path = candidates[0]?.photo_path;
      return path ? signedPhotoUrl(path) : null;
    },
  });

  const d = deriveDaily({
    profile,
    date,
    mealGroups,
    planItems,
    mealLogs,
    waterLogs,
    workoutLogs,
  });

  const initials = profile.display_name.slice(0, 2).toUpperCase();
  const mealP = d.plannedMeals > 0 ? d.completedMeals / d.plannedMeals : 0;
  const waterP = d.waterTargetMl > 0 ? d.waterLoggedMl / d.waterTargetMl : 0;
  const workoutP = d.isWorkoutDay ? (d.workoutLogged ? 1 : 0) : 1;

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Avatar className="size-8">
          {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {profile.display_name.split(" ")[0]}
            {isCurrent ? " (you)" : ""}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Flame className="size-3 text-amber-500" />
            {streak}-day streak
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <Ring progress={d.score.total / 100} size={92} stroke={8}>
          <span className="text-xl font-bold tabular-nums">
            {d.score.total}
          </span>
          <span className="text-[10px] text-muted-foreground">pts</span>
        </Ring>
      </div>

      <div className="grid grid-cols-3 gap-1">
        <MiniRing progress={mealP} color="stroke-emerald-500" label="M" />
        <MiniRing progress={waterP} color="stroke-sky-500" label="W" />
        <MiniRing progress={workoutP} color="stroke-amber-500" label="Ex" />
      </div>

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Latest"
          className="h-24 w-full rounded-lg object-cover"
        />
      ) : null}
    </div>
  );
}

function MiniRing({
  progress,
  color,
  label,
}: {
  progress: number;
  color: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Ring progress={progress} size={40} stroke={5} ringClassName={color}>
        <span className="text-[9px] text-muted-foreground">{label}</span>
      </Ring>
    </div>
  );
}
