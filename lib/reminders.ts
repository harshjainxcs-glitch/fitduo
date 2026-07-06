// Pure decision helpers for the reminder scheduler (PRD.md §4.5). Time values
// are "minutes since IST midnight" so the route can pass hourIST()*60+min.

export interface QuietHours {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Is `nowMin` inside the quiet window (handles windows that wrap midnight)? */
export function inQuietHours(nowMin: number, q: QuietHours): boolean {
  const s = toMinutes(q.start);
  const e = toMinutes(q.end);
  if (s === e) return false;
  if (s < e) return nowMin >= s && nowMin < e;
  return nowMin >= s || nowMin < e; // wraps midnight
}

export interface WaterPaceInput {
  nowMin: number;
  wakeStartMin: number; // e.g. quiet_hours.end
  wakeEndMin: number; // e.g. quiet_hours.start
  targetMl: number;
  loggedMl: number;
  intervalMin: number;
}

/**
 * Whether a water nudge is due now. During waking hours it fires once per
 * interval slot (e.g. every 3h) as long as the daily target hasn't been met.
 * `slot` buckets the day into interval-sized windows (used as the dedupe key).
 */
export function waterReminderDue(i: WaterPaceInput): {
  due: boolean;
  slot: number;
} {
  if (
    i.targetMl <= 0 ||
    i.intervalMin <= 0 ||
    i.wakeEndMin <= i.wakeStartMin ||
    i.nowMin < i.wakeStartMin ||
    i.nowMin >= i.wakeEndMin
  ) {
    return { due: false, slot: -1 };
  }
  const elapsed = i.nowMin - i.wakeStartMin;
  const slot = Math.floor(elapsed / i.intervalMin);
  return { due: i.loggedMl < i.targetMl, slot };
}

/** A planned meal is due when its target time has passed. */
export function mealReminderDue(targetTime: string, nowMin: number): boolean {
  return toMinutes(targetTime.slice(0, 5)) <= nowMin;
}
