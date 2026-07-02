// Scoring engine — single source of truth (PRD.md §7, CLAUDE.md §6).
// Pure functions. Calories are NEVER an input and never affect scoring.
// Mirrored by the daily_scores SQL view (must agree).
//
// Rules:
//   1. Applicable categories: meals (>=1 planned that weekday), water (target>0),
//      workout (weekday is a workout day).
//   2. Effective weights: eff_i = base_i / Σ(base_j applicable) × 100.
//   3. Category points: meals = eff × completed/planned; water = eff × min(1, logged/target);
//      workout = eff if >=1 workout logged else 0.
//   4. Daily total = round(sum), capped at 100.

export interface ScoringWeights {
  meals: number;
  water: number;
  workout: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  meals: 60,
  water: 15,
  workout: 25,
};

export interface ScoringInput {
  weights: ScoringWeights;
  /** Total planned meals for the day (ad-hoc meals excluded). */
  plannedMeals: number;
  /** Completed planned meals (ad-hoc completions do not count). */
  completedMeals: number;
  waterTargetMl: number;
  waterLoggedMl: number;
  /** Whether today's weekday is one of the user's workout days. */
  isWorkoutDay: boolean;
  /** Whether at least one workout has been logged today. */
  workoutLogged: boolean;
}

export interface ScoreResult {
  /** Unrounded category points (0–effectiveWeight). */
  mealPoints: number;
  waterPoints: number;
  workoutPoints: number;
  /** Rounded, capped daily total (0–100). */
  total: number;
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function computeDailyScore(input: ScoringInput): ScoreResult {
  const {
    weights,
    plannedMeals,
    completedMeals,
    waterTargetMl,
    waterLoggedMl,
    isWorkoutDay,
    workoutLogged,
  } = input;

  const mealsApplicable = plannedMeals > 0;
  const waterApplicable = waterTargetMl > 0;
  const workoutApplicable = isWorkoutDay;

  const applicableWeightTotal =
    (mealsApplicable ? weights.meals : 0) +
    (waterApplicable ? weights.water : 0) +
    (workoutApplicable ? weights.workout : 0);

  // Nothing applicable today (e.g. no meals planned, no water target, rest day).
  if (applicableWeightTotal <= 0) {
    return { mealPoints: 0, waterPoints: 0, workoutPoints: 0, total: 0 };
  }

  const effMeals = mealsApplicable
    ? (weights.meals / applicableWeightTotal) * 100
    : 0;
  const effWater = waterApplicable
    ? (weights.water / applicableWeightTotal) * 100
    : 0;
  const effWorkout = workoutApplicable
    ? (weights.workout / applicableWeightTotal) * 100
    : 0;

  const mealFraction = mealsApplicable
    ? clamp01(completedMeals / plannedMeals)
    : 0;
  const waterFraction = waterApplicable
    ? clamp01(waterLoggedMl / waterTargetMl)
    : 0;
  const workoutDone = workoutApplicable && workoutLogged ? 1 : 0;

  const mealPoints = effMeals * mealFraction;
  const waterPoints = effWater * waterFraction;
  const workoutPoints = effWorkout * workoutDone;

  const total = Math.min(
    100,
    Math.round(mealPoints + waterPoints + workoutPoints),
  );

  return { mealPoints, waterPoints, workoutPoints, total };
}
