"use client";

import { TodayHero } from "@/components/features/scoring/today-hero";
import { CoachCard } from "@/components/features/motivation/coach-card";
import { MealList } from "@/components/features/meals/meal-list";
import { WaterTracker } from "@/components/features/water/water-tracker";
import { WorkoutLogger } from "@/components/features/workout/workout-logger";
import { todayIST, dayOfWeekIST } from "@/lib/utils/date";
import type { Profile } from "@/lib/types/database.types";

// Composition root for /today. Extended across Prompts 1.6–1.9
// (meals → water → workout → rings/points/motivation).
export function TodayView({
  userId,
  profile,
}: {
  userId: string;
  profile: Profile;
}) {
  const date = todayIST();
  const dow = dayOfWeekIST(date);

  return (
    <div className="space-y-6 px-4 py-2">
      <CoachCard />
      <TodayHero userId={userId} profile={profile} date={date} />
      <WaterTracker
        userId={userId}
        date={date}
        bottleSizeMl={profile.bottle_size_ml}
        targetMl={profile.water_target_ml}
      />
      <WorkoutLogger
        userId={userId}
        date={date}
        workoutDays={profile.workout_days ?? []}
      />
      <MealList userId={userId} date={date} dow={dow} />
    </div>
  );
}
