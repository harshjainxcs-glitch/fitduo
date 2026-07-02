import { describe, it, expect } from "vitest";
import {
  inQuietHours,
  mealReminderDue,
  toMinutes,
  waterReminderDue,
} from "./reminders";

describe("inQuietHours", () => {
  const q = { start: "22:00", end: "07:00" }; // wraps midnight
  it("is quiet late night and early morning", () => {
    expect(inQuietHours(toMinutes("23:30"), q)).toBe(true);
    expect(inQuietHours(toMinutes("06:00"), q)).toBe(true);
  });
  it("is awake during the day", () => {
    expect(inQuietHours(toMinutes("09:00"), q)).toBe(false);
    expect(inQuietHours(toMinutes("21:59"), q)).toBe(false);
  });
  it("handles a same-day window", () => {
    const q2 = { start: "13:00", end: "14:00" };
    expect(inQuietHours(toMinutes("13:30"), q2)).toBe(true);
    expect(inQuietHours(toMinutes("12:59"), q2)).toBe(false);
  });
});

describe("waterReminderDue", () => {
  const base = {
    wakeStartMin: toMinutes("07:00"),
    wakeEndMin: toMinutes("22:00"),
    targetMl: 3000,
    intervalMin: 90,
  };
  it("is due when behind pace during waking hours", () => {
    // Midday (~50% of the day), 0 ml logged → behind.
    const r = waterReminderDue({ ...base, nowMin: toMinutes("14:30"), loggedMl: 0 });
    expect(r.due).toBe(true);
    expect(r.slot).toBeGreaterThanOrEqual(0);
  });
  it("is not due when on pace", () => {
    const r = waterReminderDue({
      ...base,
      nowMin: toMinutes("14:30"),
      loggedMl: 3000,
    });
    expect(r.due).toBe(false);
  });
  it("is never due outside waking hours", () => {
    const r = waterReminderDue({ ...base, nowMin: toMinutes("02:00"), loggedMl: 0 });
    expect(r.due).toBe(false);
  });
  it("advances the dedupe slot across intervals", () => {
    const early = waterReminderDue({ ...base, nowMin: toMinutes("07:30"), loggedMl: 0 });
    const later = waterReminderDue({ ...base, nowMin: toMinutes("12:00"), loggedMl: 0 });
    expect(later.slot).toBeGreaterThan(early.slot);
  });
});

describe("mealReminderDue", () => {
  it("fires once the target time has passed", () => {
    expect(mealReminderDue("08:00:00", toMinutes("08:30"))).toBe(true);
    expect(mealReminderDue("13:00", toMinutes("12:00"))).toBe(false);
  });
});
