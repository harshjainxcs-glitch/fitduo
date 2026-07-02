import { describe, it, expect } from "vitest";
import {
  computeDailyScore,
  DEFAULT_WEIGHTS,
  type ScoringInput,
} from "./scoring";

function input(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    weights: DEFAULT_WEIGHTS,
    plannedMeals: 7,
    completedMeals: 7,
    waterTargetMl: 3000,
    waterLoggedMl: 3000,
    isWorkoutDay: true,
    workoutLogged: true,
    ...overrides,
  };
}

describe("computeDailyScore", () => {
  it("scores an all-applicable perfect day as 100 (60/15/25)", () => {
    const r = computeDailyScore(input());
    expect(r.mealPoints).toBeCloseTo(60);
    expect(r.waterPoints).toBeCloseTo(15);
    expect(r.workoutPoints).toBeCloseTo(25);
    expect(r.total).toBe(100);
  });

  it("redistributes weights on a rest day and still reaches 100", () => {
    // Rest day: workout not applicable -> meals 80, water 20.
    const r = computeDailyScore(
      input({
        plannedMeals: 3,
        completedMeals: 3,
        waterTargetMl: 2000,
        waterLoggedMl: 2000,
        isWorkoutDay: false,
        workoutLogged: false,
      }),
    );
    expect(r.mealPoints).toBeCloseTo(80);
    expect(r.waterPoints).toBeCloseTo(20);
    expect(r.workoutPoints).toBe(0);
    expect(r.total).toBe(100);
  });

  it("scores 5/7 meals + 2500/3000 water + no workout as ~55", () => {
    const r = computeDailyScore(
      input({
        completedMeals: 5,
        waterLoggedMl: 2500,
        workoutLogged: false, // still a workout day, just not done
      }),
    );
    expect(r.mealPoints).toBeCloseTo((60 * 5) / 7); // 42.857
    expect(r.waterPoints).toBeCloseTo(12.5);
    expect(r.workoutPoints).toBe(0);
    expect(r.total).toBe(55);
  });

  it("scores partial water proportionally", () => {
    const r = computeDailyScore(
      input({ waterLoggedMl: 1500, workoutLogged: true, completedMeals: 7 }),
    );
    expect(r.waterPoints).toBeCloseTo(7.5); // 15 * 0.5
  });

  it("caps water at the target (over-target does not exceed the weight)", () => {
    const r = computeDailyScore(input({ waterLoggedMl: 9000 }));
    expect(r.waterPoints).toBeCloseTo(15);
    expect(r.total).toBe(100);
  });

  it("treats workout as all-or-nothing", () => {
    const notDone = computeDailyScore(input({ workoutLogged: false }));
    expect(notDone.workoutPoints).toBe(0);
    const done = computeDailyScore(input({ workoutLogged: true }));
    expect(done.workoutPoints).toBeCloseTo(25);
  });

  it("redistributes to water+workout on a zero-meal day", () => {
    // No meals planned; water(15)+workout(25) applicable -> 37.5 / 62.5.
    const r = computeDailyScore(
      input({
        plannedMeals: 0,
        completedMeals: 0,
        waterLoggedMl: 3000,
        isWorkoutDay: true,
        workoutLogged: true,
      }),
    );
    expect(r.mealPoints).toBe(0);
    expect(r.waterPoints).toBeCloseTo(37.5);
    expect(r.workoutPoints).toBeCloseTo(62.5);
    expect(r.total).toBe(100);
  });

  it("returns 0 when nothing is applicable", () => {
    const r = computeDailyScore(
      input({
        plannedMeals: 0,
        completedMeals: 0,
        waterTargetMl: 0,
        waterLoggedMl: 0,
        isWorkoutDay: false,
        workoutLogged: false,
      }),
    );
    expect(r).toEqual({
      mealPoints: 0,
      waterPoints: 0,
      workoutPoints: 0,
      total: 0,
    });
  });

  it("does not exceed full credit if completed exceeds planned", () => {
    const r = computeDailyScore(input({ completedMeals: 12, plannedMeals: 7 }));
    expect(r.mealPoints).toBeCloseTo(60);
    expect(r.total).toBe(100);
  });
});
