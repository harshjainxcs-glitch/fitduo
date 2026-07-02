"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { currentStreak, bestStreak } from "@/lib/streaks";
import {
  addDays,
  dayOfWeekIST,
  todayIST,
  weekStartIST,
} from "@/lib/utils/date";
import type {
  MealLog,
  PlanItem,
  Profile,
  WaterLog,
  WorkoutLog,
} from "@/lib/types/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RANGES = [14, 30, 90] as const;

export function HistoryView({
  profile,
  profiles,
  currentUserId,
}: {
  profile: Profile;
  profiles: Profile[];
  currentUserId: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const supabase = createClient();
  const today = todayIST();
  const start = addDays(today, -(range - 1));
  const dates: string[] = [];
  for (let d = start; d <= today; d = addDays(d, 1)) dates.push(d);

  const uid = profile.id;

  const { data: scores = [] } = useQuery({
    queryKey: ["daily_scores", uid, "range", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_scores")
        .select("*")
        .eq("user_id", uid)
        .gte("log_date", start);
      if (error) throw error;
      return data;
    },
  });
  const { data: water = [] } = useQuery({
    queryKey: ["water_logs", uid, "range", range],
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("log_date", start);
      if (error) throw error;
      return data;
    },
  });
  const { data: workouts = [] } = useQuery({
    queryKey: ["workout_logs", uid, "range", range],
    queryFn: async (): Promise<WorkoutLog[]> => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("log_date", start);
      if (error) throw error;
      return data;
    },
  });
  const { data: meals = [] } = useQuery({
    queryKey: ["meal_logs", uid, "range", range],
    queryFn: async (): Promise<MealLog[]> => {
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", uid)
        .gte("log_date", start);
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

  const label = (d: string) => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;

  const scoreByDate = new Map(scores.map((s) => [s.log_date, Number(s.total)]));
  const pointsData = dates.map((d) => ({
    date: label(d),
    points: scoreByDate.get(d) ?? 0,
  }));

  const waterByDate = new Map<string, number>();
  for (const w of water)
    waterByDate.set(w.log_date, (waterByDate.get(w.log_date) ?? 0) + w.amount_ml);
  const waterData = dates.map((d) => ({
    date: label(d),
    ml: waterByDate.get(d) ?? 0,
  }));

  // Workouts per week within the range.
  const weekCounts = new Map<string, number>();
  for (const w of workouts) {
    const ws = weekStartIST(w.log_date);
    weekCounts.set(ws, (weekCounts.get(ws) ?? 0) + 1);
  }
  const weeks: string[] = [];
  for (let ws = weekStartIST(start); ws <= today; ws = addDays(ws, 7))
    weeks.push(ws);
  const workoutData = weeks.map((ws) => ({
    week: label(ws),
    count: weekCounts.get(ws) ?? 0,
  }));

  // Calories: planned (from weekday plan) vs actual (logged).
  const plannedByWeekday = new Map<number, number>();
  for (const i of planItems) {
    if (i.is_active && i.target_calories != null) {
      plannedByWeekday.set(
        i.day_of_week,
        (plannedByWeekday.get(i.day_of_week) ?? 0) + i.target_calories,
      );
    }
  }
  const actualCalByDate = new Map<string, number>();
  for (const m of meals) {
    if (m.calories != null)
      actualCalByDate.set(
        m.log_date,
        (actualCalByDate.get(m.log_date) ?? 0) + m.calories,
      );
  }
  const hasCalories =
    plannedByWeekday.size > 0 || actualCalByDate.size > 0;
  const caloriesData = dates.map((d) => ({
    date: label(d),
    planned: plannedByWeekday.get(dayOfWeekIST(d)) ?? 0,
    actual: actualCalByDate.get(d) ?? 0,
  }));

  return (
    <div className="space-y-5 px-4 py-2">
      {/* Range selector */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={
              "rounded-full border px-3 py-1 text-sm " +
              (r === range
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground")
            }
          >
            {r}d
          </button>
        ))}
      </div>

      {/* Streaks per user */}
      <div className="grid grid-cols-2 gap-3">
        {profiles.map((p) => (
          <StreakCard
            key={p.id}
            profile={p}
            today={today}
            isCurrent={p.id === currentUserId}
          />
        ))}
      </div>

      <ChartCard title="Daily points">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={pointsData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} {...axisProps} width={28} />
            <Tooltip {...tooltipProps} />
            <Area
              dataKey="points"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Water vs target">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waterData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
            <YAxis {...axisProps} width={40} />
            <Tooltip {...tooltipProps} />
            <ReferenceLine
              y={profile.water_target_ml}
              stroke="#f59e0b"
              strokeDasharray="4 4"
            />
            <Bar dataKey="ml" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Workouts per week">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={workoutData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="week" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} width={24} />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {hasCalories ? (
        <ChartCard title="Calories — planned vs actual">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={caloriesData} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
              <YAxis {...axisProps} width={40} />
              <Tooltip {...tooltipProps} />
              <Line
                dataKey="planned"
                stroke="#a1a1aa"
                strokeDasharray="4 4"
                dot={false}
              />
              <Line dataKey="actual" stroke="#e879f9" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}
    </div>
  );
}

const chartMargin = { top: 5, right: 5, bottom: 0, left: 0 };
const axisProps = {
  tick: { fontSize: 10, fill: "currentColor" },
  stroke: "currentColor",
  opacity: 0.5,
} as const;
const tooltipProps = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "var(--muted-foreground)" },
} as const;

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

function StreakCard({
  profile,
  today,
  isCurrent,
}: {
  profile: Profile;
  today: string;
  isCurrent: boolean;
}) {
  const { data } = useQuery({
    queryKey: ["daily_scores", profile.id, "streaks"],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("daily_scores")
        .select("log_date,total")
        .eq("user_id", profile.id)
        .order("log_date", { ascending: false })
        .limit(365);
      if (error) throw error;
      const rows = data ?? [];
      return {
        current: currentStreak(rows, today),
        best: bestStreak(rows),
      };
    },
  });

  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="truncate text-sm font-medium">
          {profile.display_name.split(" ")[0]}
          {isCurrent ? " (you)" : ""}
        </p>
        <p className="flex items-center gap-1 text-2xl font-bold tabular-nums">
          <Flame className="size-5 text-amber-500" />
          {data?.current ?? 0}
        </p>
        <p className="text-xs text-muted-foreground">
          best {data?.best ?? 0} days
        </p>
      </CardContent>
    </Card>
  );
}
