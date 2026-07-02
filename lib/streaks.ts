import { addDays, daysBetween } from "@/lib/utils/date";

export interface DayScore {
  log_date: string;
  total: number;
}

/**
 * Current ongoing streak of days scoring >= threshold. An in-progress "today"
 * that hasn't hit the threshold yet does not break the streak (we count back
 * from yesterday in that case).
 */
export function currentStreak(
  rows: DayScore[],
  today: string,
  threshold = 80,
): number {
  const map = new Map(rows.map((r) => [r.log_date, r.total]));
  let date = (map.get(today) ?? 0) >= threshold ? today : addDays(today, -1);
  let streak = 0;
  while ((map.get(date) ?? 0) >= threshold) {
    streak++;
    date = addDays(date, -1);
  }
  return streak;
}

/** Longest run of consecutive days scoring >= threshold. */
export function bestStreak(rows: DayScore[], threshold = 80): number {
  const dates = rows
    .filter((r) => r.total >= threshold)
    .map((r) => r.log_date)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of dates) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
