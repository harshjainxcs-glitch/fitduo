import { dayOfWeekIST } from "@/lib/utils/date";
import type { CalendarTask } from "@/lib/types/database.types";

// Task tags with colors (literal Tailwind classes so the scanner keeps them).
export const TASK_TAGS = [
  { id: "urgent", label: "Urgent", dot: "bg-red-500", chip: "bg-red-500/10 text-red-600", block: "border-l-red-500", tint: "bg-red-500/[0.07]" },
  { id: "important", label: "Important", dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-600", block: "border-l-amber-500", tint: "bg-amber-500/[0.07]" },
  { id: "study", label: "Study", dot: "bg-blue-500", chip: "bg-blue-500/10 text-blue-600", block: "border-l-blue-500", tint: "bg-blue-500/[0.07]" },
  { id: "work", label: "Work", dot: "bg-violet-500", chip: "bg-violet-500/10 text-violet-600", block: "border-l-violet-500", tint: "bg-violet-500/[0.07]" },
  { id: "health", label: "Health", dot: "bg-teal-500", chip: "bg-teal-500/10 text-teal-600", block: "border-l-teal-500", tint: "bg-teal-500/[0.07]" },
  { id: "personal", label: "Personal", dot: "bg-pink-500", chip: "bg-pink-500/10 text-pink-600", block: "border-l-pink-500", tint: "bg-pink-500/[0.07]" },
  { id: "break", label: "Break", dot: "bg-slate-400", chip: "bg-slate-400/10 text-slate-600", block: "border-l-slate-400", tint: "bg-slate-400/[0.07]" },
] as const;

export const TAG_MAP: Record<string, (typeof TASK_TAGS)[number]> =
  Object.fromEntries(TASK_TAGS.map((t) => [t.id, t]));

export const RECURRENCES = [
  { id: "none", label: "Does not repeat" },
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Weekdays (Mon–Fri)" },
  { id: "weekly", label: "Every week" },
] as const;

/** Minutes since midnight for a 'HH:MM' / 'HH:MM:SS' string (or null). */
export function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m || 0);
}

/** Whether a (possibly recurring) task occurs on the given IST date. */
export function occursOn(task: CalendarTask, date: string): boolean {
  if (date < task.task_date) return false;
  switch (task.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return dayOfWeekIST(date) === dayOfWeekIST(task.task_date);
    case "weekdays":
      return dayOfWeekIST(date) <= 4; // 0=Mon … 4=Fri
    default:
      return date === task.task_date;
  }
}

/** Tasks occurring on a date, sorted: all-day/untimed first, then by start time. */
export function tasksOnDate(tasks: CalendarTask[], date: string): CalendarTask[] {
  return tasks
    .filter((t) => occursOn(t, date))
    .sort((a, b) => {
      const ta = a.all_day ? -1 : (timeToMinutes(a.start_time) ?? 24 * 60);
      const tb = b.all_day ? -1 : (timeToMinutes(b.start_time) ?? 24 * 60);
      return ta - tb;
    });
}

export const primaryTag = (task: CalendarTask) =>
  task.tags.length ? TAG_MAP[task.tags[0]] : undefined;

// Day-timeline geometry.
export const DAY_HOURS = Array.from({ length: 24 }, (_, i) => i);
export const HOUR_HEIGHT = 68; // px
