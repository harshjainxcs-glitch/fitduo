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
 * Whether a water nudge is due now: only during waking hours, only when behind
 * the linear pace toward the target. `slot` buckets the day into interval-sized
 * windows so at most one nudge fires per interval (used as the dedupe key).
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
  const total = i.wakeEndMin - i.wakeStartMin;
  const elapsed = i.nowMin - i.wakeStartMin;
  const expected = i.targetMl * (elapsed / total);
  const slot = Math.floor(elapsed / i.intervalMin);
  return { due: i.loggedMl < expected, slot };
}

/** A planned meal is due when its target time has passed. */
export function mealReminderDue(targetTime: string, nowMin: number): boolean {
  return toMinutes(targetTime.slice(0, 5)) <= nowMin;
}
