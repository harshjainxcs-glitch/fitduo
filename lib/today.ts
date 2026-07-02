import { computeDailyScore, type ScoreResult } from "@/lib/scoring/scoring";
import { dayOfWeekIST } from "@/lib/utils/date";
import type {
  MealLog,
  PlanItem,
  Profile,
  WaterLog,
  WorkoutLog,
} from "@/lib/types/database.types";

export interface DailyDerived {
  plannedMeals: number;
  completedMeals: number;
  waterLoggedMl: number;
  waterTargetMl: number;
  isWorkoutDay: boolean;
  workoutLogged: boolean;
  plannedCalories: number;
  actualCalories: number;
  hasCalorieData: boolean;
  score: ScoreResult;
}

/** Derive a day's counts + score from raw rows. Pure; mirrors the scoring rules. */
export function deriveDaily(params: {
  profile: Profile;
  date: string;
  planItems: PlanItem[];
  mealLogs: MealLog[]; // today's meal logs
  waterLogs: WaterLog[]; // today's water logs
  workoutLogs: WorkoutLog[]; // may span the week; filtered by date here
}): DailyDerived {
  const { profile, date, planItems, mealLogs, waterLogs, workoutLogs } = params;
  const dow = dayOfWeekIST(date);

  const todaysPlan = planItems.filter(
    (i) => i.day_of_week === dow && i.is_active,
  );
  const plannedMeals = todaysPlan.length;
  const completedMeals = mealLogs.filter(
    (l) => l.plan_item_id && l.status === "completed",
  ).length;
  const waterLoggedMl = waterLogs.reduce((s, l) => s + l.amount_ml, 0);
  const isWorkoutDay = (profile.workout_days ?? []).includes(dow);
  const workoutLogged = workoutLogs.some((l) => l.log_date === date);

  const plannedCalories = todaysPlan.reduce(
    (s, i) => s + (i.target_calories ?? 0),
    0,
  );
  const actualCalories = mealLogs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const hasCalorieData = plannedCalories > 0 || actualCalories > 0;

  const score: ScoreResult = computeDailyScore({
    weights: {
      meals: profile.weight_meals,
      water: profile.weight_water,
      workout: profile.weight_workout,
    },
    plannedMeals,
    completedMeals,
    waterTargetMl: profile.water_target_ml,
    waterLoggedMl,
    isWorkoutDay,
    workoutLogged,
  });

  return {
    plannedMeals,
    completedMeals,
    waterLoggedMl,
    waterTargetMl: profile.water_target_ml,
    isWorkoutDay,
    workoutLogged,
    plannedCalories,
    actualCalories,
    hasCalorieData,
    score,
  };
}
