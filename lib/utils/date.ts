// IST (Asia/Kolkata) day/week helpers — the ONLY place day/week boundaries are
// computed (CLAUDE.md §3). A "day" is a local IST calendar day; a "week" starts
// Monday 00:00 IST. Calendar-date math is done on 'yyyy-MM-dd' strings anchored
// at UTC noon (timezone-agnostic for pure date arithmetic); "what is now in IST"
// uses date-fns-tz with NEXT_PUBLIC_APP_TZ.
import { formatInTimeZone } from "date-fns-tz";

export const APP_TZ = process.env.NEXT_PUBLIC_APP_TZ || "Asia/Kolkata";

/** A calendar date as 'yyyy-MM-dd', interpreted in IST. */
export type ISODate = string;

const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Today's IST calendar date as 'yyyy-MM-dd'. */
export function todayIST(now: Date = new Date()): ISODate {
  return formatInTimeZone(now, APP_TZ, "yyyy-MM-dd");
}

/** Current hour (0–23) in IST. */
export function hourIST(now: Date = new Date()): number {
  return Number(formatInTimeZone(now, APP_TZ, "H"));
}

/** Minutes since IST midnight (0–1439). */
export function minutesOfDayIST(now: Date = new Date()): number {
  return Number(formatInTimeZone(now, APP_TZ, "H")) * 60 +
    Number(formatInTimeZone(now, APP_TZ, "m"));
}

// --- pure calendar-date math (anchored at UTC noon so DST/offsets never shift the day) ---
function toNoonUTC(date: ISODate): Date {
  return new Date(`${date}T12:00:00Z`);
}
function fmtISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Day of week for an IST calendar date. 0=Mon … 6=Sun. */
export function dayOfWeekIST(date: ISODate = todayIST()): number {
  return (toNoonUTC(date).getUTCDay() + 6) % 7;
}

/** Add n days (may be negative) to a calendar date. */
export function addDays(date: ISODate, n: number): ISODate {
  const d = toNoonUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtISO(d);
}

/** Whole days between two calendar dates (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round(
    (toNoonUTC(b).getTime() - toNoonUTC(a).getTime()) / 86_400_000,
  );
}

/** Monday (week start) of the week containing the given IST date. */
export function weekStartIST(date: ISODate = todayIST()): ISODate {
  return addDays(date, -dayOfWeekIST(date));
}

/** The 7 calendar dates (Mon…Sun) of the week that contains `date`. */
export function weekDatesIST(date: ISODate = todayIST()): ISODate[] {
  const start = weekStartIST(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Full ("Monday") or short ("Mon") weekday label for a calendar date. */
export function weekdayLabel(date: ISODate, short = false): string {
  const i = dayOfWeekIST(date);
  return (short ? WEEKDAY_SHORT : WEEKDAY_LONG)[i];
}

/** Weekday label from a 0=Mon…6=Sun index. */
export function weekdayLabelFromIndex(index: number, short = false): string {
  return (short ? WEEKDAY_SHORT : WEEKDAY_LONG)[((index % 7) + 7) % 7];
}

/** "Thursday, 2 Jul" style label for a calendar date. */
export function formatDisplayDate(date: ISODate = todayIST()): string {
  return formatInTimeZone(toNoonUTC(date), APP_TZ, "EEEE, d MMM");
}

/** "2 Jul, 8:30 AM" from a timestamptz string (rendered in IST). */
export function formatDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), APP_TZ, "d MMM, h:mm a");
}

/** Time-of-day greeting based on the current IST hour. */
export function greeting(now: Date = new Date()): string {
  const h = hourIST(now);
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Format a 'HH:mm' / 'HH:mm:ss' time string as "h:mm AM/PM". */
export function formatTime(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr ?? "0");
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
