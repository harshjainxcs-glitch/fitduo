import { computeDailyScore, type ScoreResult } from "@/lib/scoring/scoring";
import { dayOfWeekIST } from "@/lib/utils/date";
import type {
  MealGroup,
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
  mealGroups: MealGroup[]; // meals apply to every day
  planItems: PlanItem[]; // food items (for planned calories)
  mealLogs: MealLog[]; // today's meal logs
  waterLogs: WaterLog[]; // today's water logs
  workoutLogs: WorkoutLog[]; // may span the week; filtered by date here
}): DailyDerived {
  const { profile, date, mealGroups, planItems, mealLogs, waterLogs, workoutLogs } = params;
  const dow = dayOfWeekIST(date);

  const plannedMeals = mealGroups.length;
  const completedMeals = new Set(
    mealLogs
      .filter((l) => l.meal_group_id && l.status === "completed")
      .map((l) => l.meal_group_id),
  ).size;

  const waterLoggedMl = waterLogs.reduce((s, l) => s + l.amount_ml, 0);
  const isWorkoutDay = (profile.workout_days ?? []).includes(dow);
  const workoutLogged = workoutLogs.some((l) => l.log_date === date);

  const todaysItems = planItems.filter(
    (i) => i.day_of_week === dow && i.is_active,
  );
  const plannedCalories = todaysItems.reduce(
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
