import type { MealSlot, NotifPrefs } from "@/lib/types/database.types";

// Ordered meal slots (PRD.md §4.2) with display labels.
export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: "pre_breakfast", label: "Pre-breakfast" },
  { slot: "breakfast", label: "Breakfast" },
  { slot: "post_breakfast", label: "Post-breakfast" },
  { slot: "mid_morning_snack", label: "Mid-morning snack" },
  { slot: "lunch", label: "Lunch" },
  { slot: "evening_snack", label: "Evening snack" },
  { slot: "dinner", label: "Dinner" },
  { slot: "post_dinner", label: "Post-dinner" },
];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = Object.fromEntries(
  MEAL_SLOTS.map((s) => [s.slot, s.label]),
) as Record<MealSlot, string>;

// 0=Mon … 6=Sun (matches lib/utils/date.ts and day_of_week).
export const WEEKDAYS: { index: number; short: string; long: string }[] = [
  { index: 0, short: "Mon", long: "Monday" },
  { index: 1, short: "Tue", long: "Tuesday" },
  { index: 2, short: "Wed", long: "Wednesday" },
  { index: 3, short: "Thu", long: "Thursday" },
  { index: 4, short: "Fri", long: "Friday" },
  { index: 5, short: "Sat", long: "Saturday" },
  { index: 6, short: "Sun", long: "Sunday" },
];

export const DEFAULT_NOTIF_PREFS: Required<
  Pick<NotifPrefs, "water" | "meals" | "partner" | "weekly" | "water_interval_min">
> & { quiet_hours: { start: string; end: string } } = {
  water: true,
  meals: true,
  partner: true,
  weekly: true,
  water_interval_min: 90,
  quiet_hours: { start: "22:00", end: "07:00" },
};

/** Merge a profile's stored notif_prefs (Json) with defaults. */
export function resolveNotifPrefs(raw: unknown): typeof DEFAULT_NOTIF_PREFS {
  const p = (raw ?? {}) as NotifPrefs;
  return {
    water: p.water ?? DEFAULT_NOTIF_PREFS.water,
    meals: p.meals ?? DEFAULT_NOTIF_PREFS.meals,
    partner: p.partner ?? DEFAULT_NOTIF_PREFS.partner,
    weekly: p.weekly ?? DEFAULT_NOTIF_PREFS.weekly,
    water_interval_min:
      p.water_interval_min ?? DEFAULT_NOTIF_PREFS.water_interval_min,
    quiet_hours: {
      start: p.quiet_hours?.start ?? DEFAULT_NOTIF_PREFS.quiet_hours.start,
      end: p.quiet_hours?.end ?? DEFAULT_NOTIF_PREFS.quiet_hours.end,
    },
  };
}
